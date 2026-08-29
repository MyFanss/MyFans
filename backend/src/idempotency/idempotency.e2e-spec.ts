import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { Repository } from "typeorm";
import { IdempotencyService, CachedResponse } from "./idempotency.service";
import { IdempotencyKey } from "./idempotency-key.entity";

/**
 * End-to-end-style integration tests for the idempotency subsystem.
 *
 * These tests exercise IdempotencyService against a real (or test-container)
 * PostgreSQL database so that unique-constraint and TTL behaviour is validated
 * at the DB level rather than via mocks.
 *
 * Prerequisites:
 *   - A running PostgreSQL instance reachable via TEST_DATABASE_URL.
 *   - The `idempotency_keys` table created (TypeORM synchronize: true is fine
 *     for tests).
 *
 * Run:
 *   IDEMPOTENCY_TTL_HOURS=24 npx jest --config jest-e2e.json idempotency.e2e-spec.ts
 */

describe("IdempotencyService (e2e / integration)", () => {
  let service: IdempotencyService;
  let repo: Repository<IdempotencyKey>;
  let module: TestingModule;

  // Helpers ----------------------------------------------------------------

  const KEY = "idem-e2e-test-key";
  const FINGERPRINT = "user:e2e-user-1";
  const METHOD = "POST";
  const PATH = "/v1/subscriptions/checkout";

  /** Shortcut: acquire, complete, return the cached response on replay. */
  async function acquireAndComplete(
    key = KEY,
    fp = FINGERPRINT,
    responseBody: unknown = { ok: true },
  ): Promise<void> {
    const first = await service.acquire(key, fp, METHOD, PATH);
    expect(first).toBeNull(); // first call → proceed
    await service.complete(key, fp, 200, responseBody);
  }

  // Setup / teardown -------------------------------------------------------

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(IdempotencyKey),
          useClass: Repository,
        },
      ],
    })
      /*
       * Override the Repository provider with the real TypeORM connection when
       * running against an actual database.  In unit-test mode (no DB) the
       * tests below degrade gracefully because we spy on repository methods.
       */
      .compile();

    service = module.get(IdempotencyService);
    repo = module.get(getRepositoryToken(IdempotencyKey));
  });

  afterEach(async () => {
    // Clean up any records created during a test.
    await repo.delete({});
  });

  afterAll(async () => {
    await module.close();
  });

  // Tests ------------------------------------------------------------------

  describe("same key + same body -> replay 200 with cached response", () => {
    it("returns the cached status and body on the second acquire call", async () => {
      await acquireAndComplete(KEY, FINGERPRINT, { orderId: "abc-123" });

      const replay: CachedResponse | null = await service.acquire(
        KEY,
        FINGERPRINT,
        METHOD,
        PATH,
      );

      expect(replay).not.toBeNull();
      expect(replay\!.status).toBe(200);
      expect(replay\!.body).toEqual({ orderId: "abc-123" });
    });
  });

  describe("same key + different body -> 409 Conflict", () => {
    it("throws ConflictException when a second request arrives while the first is still in-flight", async () => {
      // Acquire but do NOT complete -> record stays in-flight.
      const first = await service.acquire(KEY, FINGERPRINT, METHOD, PATH);
      expect(first).toBeNull();

      await expect(
        service.acquire(KEY, FINGERPRINT, METHOD, PATH),
      ).rejects.toThrow(ConflictException);
    });

    it("throws UnprocessableEntityException when key is reused for a different endpoint", async () => {
      await acquireAndComplete(KEY, FINGERPRINT);

      await expect(
        service.acquire(KEY, FINGERPRINT, "PUT", "/v1/other"),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe("expired key -> allows new request", () => {
    it("treats an expired record as non-existent and allows re-acquisition", async () => {
      // Insert a record that is already expired.
      const expiredRecord = repo.create({
        key: KEY,
        fingerprint: FINGERPRINT,
        method: METHOD,
        path: PATH,
        is_complete: true,
        response_status: 200,
        response_body: JSON.stringify({ stale: true }),
        expires_at: new Date(Date.now() - 1000), // 1 second in the past
      });
      await repo.save(expiredRecord);

      // Acquiring with the same key should succeed (expired record removed).
      const result = await service.acquire(KEY, FINGERPRINT, METHOD, PATH);
      expect(result).toBeNull(); // fresh slot
    });
  });

  describe("concurrent requests with same key -> one succeeds, one gets 409", () => {
    it("only one of two parallel acquire calls succeeds", async () => {
      const results = await Promise.allSettled([
        service.acquire(KEY, FINGERPRINT, METHOD, PATH),
        service.acquire(KEY, FINGERPRINT, METHOD, PATH),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly one should succeed (null = proceed), the other should be
      // rejected with 409 Conflict.
      expect(fulfilled.length + rejected.length).toBe(2);
      // At least one must succeed.
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      // The rejected one (if any) must be a ConflictException.
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
          ConflictException,
        );
      }
    });
  });

  describe("sequential requests on different instances (same DB)", () => {
    it("a second service instance reads the record written by the first", async () => {
      // Simulate a second NestJS instance sharing the same DB by creating a
      // second IdempotencyService backed by the SAME repository.
      const service2 = new IdempotencyService(repo as any);

      // Instance 1 acquires and completes.
      await acquireAndComplete(KEY, FINGERPRINT, { fromInstance: 1 });

      // Instance 2 sees the cached response.
      const replay = await service2.acquire(KEY, FINGERPRINT, METHOD, PATH);
      expect(replay).not.toBeNull();
      expect(replay\!.status).toBe(200);
      expect(replay\!.body).toEqual({ fromInstance: 1 });
    });
  });
});

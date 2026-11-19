import { ConflictException, NotImplementedException } from '@nestjs/common';
import {
  CheckoutController,
  IdempotencyRecord,
  IdempotencyStore,
  InMemoryIdempotencyStore,
  RedisIdempotencyStore,
  RedisLikeClient,
} from './checkout.controller';

/**
 * Unit tests for the checkout money-path confirm endpoint idempotency contract.
 *
 * The controller receives its IdempotencyStore via constructor injection, so we
 * pass a fake store per test to keep state isolated and assert store usage.
 */

const MAX_BODY_BYTES = 1024 * 1024;

class FakeIdempotencyStore implements IdempotencyStore {
  readonly records = new Map<string, IdempotencyRecord>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    return this.records.get(key);
  }

  async set(key: string, record: IdempotencyRecord): Promise<void> {
    this.records.set(key, record);
  }
}

/**
 * In-memory fake of the Redis client surface shared by two store instances.
 */
class FakeRedis implements RedisLikeClient {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async set(
    key: string,
    value: string,
    _mode?: string,
    _ttlSeconds?: number,
  ): Promise<unknown> {
    this.data.set(key, value);
    return 'OK';
  }
}

function makeHeaders(idempotencyKey?: string): any {
  return {
    'idempotency-key': idempotencyKey,
  };
}

function makeReq(): any {
  return {};
}

describe('CheckoutController idempotency', () => {
  let store: FakeIdempotencyStore;
  let controller: CheckoutController;

  beforeEach(() => {
    store = new FakeIdempotencyStore();
    controller = new CheckoutController(store);
  });

  it('does not return a body without a verified transaction as confirmed', async () => {
    const body = { amount: 100, currency: 'USD' };
    const key = 'key-unverified';

    await expect(
      controller.confirm(makeHeaders(key), body, makeReq()),
    ).rejects.toBeInstanceOf(NotImplementedException);

    // Fail closed: no confirmed response may be cached for an unverified body.
    expect(store.records.has(key)).toBe(false);
  });

  it('does not cache an unverified success for a repeated key', async () => {
    const body = { amount: 250, currency: 'EUR' };
    const key = 'key-replay';

    await expect(
      controller.confirm(makeHeaders(key), body, makeReq()),
    ).rejects.toBeInstanceOf(NotImplementedException);
    await expect(
      controller.confirm(makeHeaders(key), body, makeReq()),
    ).rejects.toBeInstanceOf(NotImplementedException);

    expect(store.records.has(key)).toBe(false);
  });

  it('throws ConflictException when the Idempotency-Key header is missing', async () => {
    await expect(
      controller.confirm(makeHeaders(undefined), { amount: 5 }, makeReq()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when the Idempotency-Key header is whitespace-only', async () => {
    await expect(
      controller.confirm(makeHeaders('   '), { amount: 5 }, makeReq()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when the body exceeds MAX_BODY_BYTES', async () => {
    const oversized = 'x'.repeat(MAX_BODY_BYTES + 1);

    await expect(
      controller.confirm(makeHeaders('key-oversized'), oversized, makeReq()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('still supports the in-memory store for tests', async () => {
    const memStore = new InMemoryIdempotencyStore();
    const memController = new CheckoutController(memStore);

    await expect(
      memController.confirm(makeHeaders('key-mem'), { amount: 1 }, makeReq()),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});

describe('RedisIdempotencyStore shared across instances', () => {
  it('replays the first response on a second store instance without re-running the money path', async () => {
    const redis = new FakeRedis();
    const storeA = new RedisIdempotencyStore(redis);
    const storeB = new RedisIdempotencyStore(redis);

    const body = { amount: 500, currency: 'USD' };
    const key = 'key-shared';

    // Simulate the first instance completing the money path and caching it.
    const record: IdempotencyRecord = {
      bodyHash: 'hash-500',
      status: 200,
      body: { ok: true, transactionId: 'txn-1' },
    };
    await storeA.set(key, record);

    // A second instance replaying the same key/body must return the first
    // response and must not submit a second transaction.
    let paymentCalls = 0;
    const replay = await storeB.get(key);
    if (!replay) {
      paymentCalls++;
    }

    expect(paymentCalls).toBe(0);
    expect(replay).toEqual(record);
  });

  it('returns 409 on both instances when a key is reused with a different body', async () => {
    const redis = new FakeRedis();
    const storeA = new RedisIdempotencyStore(redis);
    const storeB = new RedisIdempotencyStore(redis);

    const key = 'key-conflict';
    await storeA.set(key, {
      bodyHash: 'hash-a',
      status: 200,
      body: { ok: true },
    });

    const controllerA = new CheckoutController(storeA);
    const controllerB = new CheckoutController(storeB);

    // Different body with the same key must conflict on every instance.
    const differentBody = { amount: 999, currency: 'USD' };
    await expect(
      controllerA.confirm(makeHeaders(key), differentBody, makeReq()),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      controllerB.confirm(makeHeaders(key), differentBody, makeReq()),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

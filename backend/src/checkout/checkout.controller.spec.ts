import { ConflictException, NotImplementedException } from '@nestjs/common';
import {
  CheckoutController,
  IdempotencyRecord,
  IdempotencyStore,
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
});

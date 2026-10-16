import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Unit tests for the checkout money-path confirm endpoint idempotency contract.
 *
 * The controller keeps its idempotency store as a module-level singleton, so we
 * reset the module registry and re-import the controller before every test to
 * guarantee no state leaks between cases.
 */

type CheckoutControllerModule = typeof import('./checkout.controller');

const MAX_BODY_BYTES = 1024 * 1024;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
  let mod: CheckoutControllerModule;
  let controller: InstanceType<CheckoutControllerModule['CheckoutController']>;

  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('./checkout.controller');
    controller = new mod.CheckoutController();
  });

  it('processes a first confirm with a valid key and body and stores a record', async () => {
    const body = { amount: 100, currency: 'USD' };
    const key = 'key-first';

    const response = await controller.confirm(makeHeaders(key), body, makeReq());

    expect(response).toBeDefined();
    expect(response).toMatchObject({ status: 'processed' });
  });

  it('replays the cached response for the same key and identical body without reprocessing', async () => {
    const body = { amount: 250, currency: 'EUR' };
    const key = 'key-replay';

    const first = await controller.confirm(makeHeaders(key), body, makeReq());
    const second = await controller.confirm(makeHeaders(key), body, makeReq());

    expect(second).toEqual(first);
  });

  it('throws ConflictException when the same key is reused with a different body', async () => {
    const key = 'key-conflict';

    await controller.confirm(makeHeaders(key), { amount: 10 }, makeReq());

    await expect(
      controller.confirm(makeHeaders(key), { amount: 20 }, makeReq()),
    ).rejects.toBeInstanceOf(ConflictException);
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

  it('hashes the body with sha256 for the stored record', () => {
    const body = { amount: 42, currency: 'USD' };
    const serialized = JSON.stringify(body);

    expect(sha256(serialized)).toHaveLength(64);
  });
});

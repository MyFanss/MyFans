import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Request, Response } from 'express';
import { IdempotencyMiddleware, IDEMPOTENCY_KEY_HEADER } from './idempotency.middleware';
import { IdempotencyService } from './idempotency.service';

const mockIdempotencyService = () => ({
  acquire: jest.fn(),
  complete: jest.fn(),
  release: jest.fn(),
});

function buildReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: {},
    method: 'POST',
    path: '/v1/posts',
    ip: '127.0.0.1',
    ...overrides,
  };
}

function buildRes(): Partial<Response> & { json: jest.Mock; status: jest.Mock } {
  const res: any = {
    statusCode: 201,
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('IdempotencyMiddleware', () => {
  let middleware: IdempotencyMiddleware;
  let svc: ReturnType<typeof mockIdempotencyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyMiddleware,
        { provide: IdempotencyService, useFactory: mockIdempotencyService },
      ],
    }).compile();

    middleware = module.get(IdempotencyMiddleware);
    svc = module.get(IdempotencyService);
  });

  it('calls next() immediately when no Idempotency-Key header is present', async () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    await middleware.use(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(svc.acquire).not.toHaveBeenCalled();
  });

  it('throws UnprocessableEntityException when key exceeds 255 chars', async () => {
    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'x'.repeat(256) },
    });
    const res = buildRes();
    const next = jest.fn();

    await expect(
      middleware.use(req as Request, res as Response, next),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('calls next() and intercepts json() for a new key', async () => {
    svc.acquire.mockResolvedValue(null); // first time
    svc.complete.mockResolvedValue(undefined);

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-001' },
    });
    const res = buildRes();
    const next = jest.fn();

    await middleware.use(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    // Simulate handler calling res.json()
    (res as any).json({ id: '1' });
    // complete() is called asynchronously — give it a tick
    await Promise.resolve();
    expect(svc.complete).toHaveBeenCalledWith('key-001', expect.any(String), 201, { id: '1' });
  });

  it('replays cached response and does NOT call next() for a duplicate', async () => {
    svc.acquire.mockResolvedValue({ status: 201, body: { id: '42' } });

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-dup' },
    });
    const res = buildRes();
    const next = jest.fn();

    await middleware.use(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: '42' });
  });

  it('re-throws ConflictException when first request is still in-flight', async () => {
    svc.acquire.mockRejectedValue(
      new ConflictException('already being processed'),
    );

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-inflight' },
    });
    const res = buildRes();
    const next = jest.fn();

    await expect(
      middleware.use(req as Request, res as Response, next),
    ).rejects.toThrow(ConflictException);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls release() when handler returns a non-2xx status', async () => {
    svc.acquire.mockResolvedValue(null);
    svc.release.mockResolvedValue(undefined);

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-err' },
    });
    const res = buildRes();
    res.statusCode = 400;
    const next = jest.fn();

    await middleware.use(req as Request, res as Response, next);
    (res as any).json({ message: 'Bad Request' });
    await Promise.resolve();

    expect(svc.release).toHaveBeenCalledWith('key-err', expect.any(String));
    expect(svc.complete).not.toHaveBeenCalled();
  });

  it('uses userId as fingerprint when user is authenticated', async () => {
    svc.acquire.mockResolvedValue(null);
    svc.complete.mockResolvedValue(undefined);

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-auth' },
    }) as any;
    req.user = { id: 'user-uuid-123' };

    const res = buildRes();
    const next = jest.fn();

    await middleware.use(req as Request, res as Response, next);

    expect(svc.acquire).toHaveBeenCalledWith(
      'key-auth',
      'user:user-uuid-123',
      'POST',
      '/v1/posts',
    );
  });

  it('falls back to IP fingerprint when user is not authenticated', async () => {
    svc.acquire.mockResolvedValue(null);
    svc.complete.mockResolvedValue(undefined);

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-anon' },
      ip: '10.0.0.1',
    });
    const res = buildRes();
    const next = jest.fn();

    await middleware.use(req as Request, res as Response, next);

    expect(svc.acquire).toHaveBeenCalledWith(
      'key-anon',
      'ip:10.0.0.1',
      'POST',
      '/v1/posts',
    );
  });

  it('re-throws UnprocessableEntityException on method/path mismatch', async () => {
    svc.acquire.mockRejectedValue(
      new UnprocessableEntityException('key reused on different endpoint'),
    );

    const req = buildReq({
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'key-mismatch' },
    });
    const res = buildRes();
    const next = jest.fn();

    await expect(
      middleware.use(req as Request, res as Response, next),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(next).not.toHaveBeenCalled();
  });
});

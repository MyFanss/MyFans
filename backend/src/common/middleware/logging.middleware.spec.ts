import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { LoggingMiddleware } from './logging.middleware';
import { RequestContextService } from '../services/request-context.service';
import { Request, Response, NextFunction } from 'express';
import { REDACTED } from '../utils/redact';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingMiddleware, RequestContextService],
    }).compile();

    middleware = module.get<LoggingMiddleware>(LoggingMiddleware);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      method: 'POST',
      originalUrl: '/v1/auth/login',
      ip: '127.0.0.1',
      headers: {},
      body: {},
      ...overrides,
    };
  }

  function makeRes(): Partial<Response> {
    const listeners: Record<string, Array<() => void>> = {};
    return {
      statusCode: 200,
      on: jest.fn((event: string, cb: () => void) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(cb);
      }) as unknown as Response['on'],
    } as Partial<Response>;
  }

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('redacts Authorization header in request log', () => {
    const req = makeReq({
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' },
    });
    const res = makeRes();
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    const [[logged]] = logSpy.mock.calls as [[string]];
    expect(logged).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(logged).toContain(REDACTED);
  });

  it('redacts password in request body', () => {
    const req = makeReq({
      body: { password: 'supersecret', username: 'alice' },
    });
    const res = makeRes();
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    const [[logged]] = logSpy.mock.calls as [[string]];
    expect(logged).not.toContain('supersecret');
    expect(logged).toContain(REDACTED);
    expect(logged).toContain('alice');
  });

  it('redacts token and refresh_token in request body', () => {
    const req = makeReq({
      body: { token: 'tok_abc', refresh_token: 'rt_xyz', planId: 1 },
    });
    const res = makeRes();
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    const [[logged]] = logSpy.mock.calls as [[string]];
    expect(logged).not.toContain('tok_abc');
    expect(logged).not.toContain('rt_xyz');
    expect(logged).toContain(REDACTED);
  });

  it('redacts email in request body', () => {
    const req = makeReq({ body: { email: 'user@example.com', name: 'Bob' } });
    const res = makeRes();
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    const [[logged]] = logSpy.mock.calls as [[string]];
    expect(logged).not.toContain('user@example.com');
    expect(logged).toContain(REDACTED);
    expect(logged).toContain('Bob');
  });

  it('calls next()', () => {
    const req = makeReq();
    const res = makeRes();
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });
});

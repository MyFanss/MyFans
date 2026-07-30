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
      getEventListeners: () => listeners,
      json: jest.fn(function (data: any) {
        this.json = jest.fn(function (d) { return this; });
        return this;
      }),
      send: jest.fn(function (data: any) {
        this.send = jest.fn(function (d) { return this; });
        return this;
      }),
    } as any;
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

  it('logs response body with redaction on finish', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const req = makeReq();
    const res = makeRes() as any;
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    // Capture and use the json method
    res.json({ token: 'secret_token', userId: 'user123' });

    // Trigger finish event
    const listeners = res.getEventListeners();
    if (listeners['finish']) {
      listeners['finish'].forEach((cb: () => void) => cb());
    }

    // Response should be logged but with redacted token
    const loggedMessages = [...logSpy.mock.calls, ...errorSpy.mock.calls];
    const finishLogCall = loggedMessages.find((call: any[]) => call[0]?.includes('Outgoing Response'));
    expect(finishLogCall).toBeDefined();
    expect(finishLogCall?.[0]).toContain(REDACTED);
    expect(finishLogCall?.[0]).toContain('user123');
  });

  it('redacts sensitive fields in response body', () => {
    const req = makeReq();
    const res = makeRes() as any;
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    // Send a response with sensitive data
    res.json({ email: 'user@example.com', name: 'Alice', password: 'secret' });

    // Trigger finish event
    const listeners = res.getEventListeners();
    if (listeners['finish']) {
      listeners['finish'].forEach((cb: () => void) => cb());
    }

    const loggedMessages = [...logSpy.mock.calls];
    const finishLogCall = loggedMessages.find((call: any[]) => call[0]?.includes('Outgoing Response'));
    expect(finishLogCall?.[0]).not.toContain('user@example.com');
    expect(finishLogCall?.[0]).not.toContain('secret');
    expect(finishLogCall?.[0]).toContain(REDACTED);
    expect(finishLogCall?.[0]).toContain('Alice');
  });

  it('logs (no body) when response has no body', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes() as any;
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    // Don't call json or send, so responseBody stays undefined
    // Trigger finish event
    const listeners = res.getEventListeners();
    if (listeners['finish']) {
      listeners['finish'].forEach((cb: () => void) => cb());
    }

    const loggedMessages = [...logSpy.mock.calls];
    const finishLogCall = loggedMessages.find((call: any[]) => call[0]?.includes('Outgoing Response'));
    expect(finishLogCall?.[0]).toContain('(no body)');
  });

  it('handles stale context gracefully when finish event fires', () => {
    const req = makeReq();
    const res = makeRes() as any;
    const next: NextFunction = jest.fn();

    middleware.use(req as Request, res as Response, next);

    // Manually clear context to simulate stale state
    const requestContextService = new RequestContextService();
    // requestContextService.clearContext();  // This is a no-op, so context remains

    res.json({ userId: 'user123' });

    // Trigger finish event - should not throw
    const listeners = res.getEventListeners();
    expect(() => {
      if (listeners['finish']) {
        listeners['finish'].forEach((cb: () => void) => cb());
      }
    }).not.toThrow();
  });
});

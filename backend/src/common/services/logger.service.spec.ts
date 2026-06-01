import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { LoggerService } from './logger.service';
import { RequestContextService } from './request-context.service';
import { LOG_FIELDS, SERVICE_NAME } from '../logger/log-fields';

describe('LoggerService – structured log fields standard', () => {
  let service: LoggerService;
  let winstonLogger: Record<string, jest.Mock>;
  let requestContextService: Partial<RequestContextService>;

  beforeEach(async () => {
    winstonLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      log: jest.fn(),
    };

    requestContextService = {
      getLogContext: jest.fn().mockReturnValue({
        [LOG_FIELDS.CORRELATION_ID]: 'corr-123',
        [LOG_FIELDS.REQUEST_ID]: 'req-456',
        [LOG_FIELDS.USER_ID]: 'GUSER',
        [LOG_FIELDS.METHOD]: 'GET',
        [LOG_FIELDS.URL]: '/v1/subscriptions',
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        LoggerService,
        { provide: RequestContextService, useValue: requestContextService },
        { provide: WINSTON_MODULE_PROVIDER, useValue: winstonLogger },
      ],
    }).compile();

    service = module.get(LoggerService);
  });

  it('log() emits info with context field using canonical name', () => {
    service.log('hello', 'MyModule');
    expect(winstonLogger.info).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ [LOG_FIELDS.CONTEXT]: 'MyModule' }),
    );
  });

  it('log() defaults context to "Application" when omitted', () => {
    service.log('hello');
    expect(winstonLogger.info).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ [LOG_FIELDS.CONTEXT]: 'Application' }),
    );
  });

  it('error() includes trace under canonical field name', () => {
    service.error('boom', 'Error: stack', 'Ctx');
    expect(winstonLogger.error).toHaveBeenCalledWith(
      'boom',
      expect.objectContaining({ [LOG_FIELDS.TRACE]: 'Error: stack' }),
    );
  });

  it('error() omits trace field when not provided', () => {
    service.error('boom');
    const [, meta] = winstonLogger.error.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta).not.toHaveProperty(LOG_FIELDS.TRACE);
  });

  it('logStructured() emits data under canonical field name', () => {
    service.logStructured('info', 'structured', { foo: 'bar' }, 'Ctx');
    expect(winstonLogger.log).toHaveBeenCalledWith(
      'info',
      'structured',
      expect.objectContaining({ [LOG_FIELDS.DATA]: { foo: 'bar' } }),
    );
  });

  it('logStructured() redacts sensitive fields in data', () => {
    service.logStructured('info', 'auth', { password: 'secret', userId: 'u1' });
    const [, , meta] = winstonLogger.log.mock.calls[0] as [string, string, Record<string, unknown>];
    const data = meta[LOG_FIELDS.DATA] as Record<string, unknown>;
    expect(data['password']).toBe('[REDACTED]');
    expect(data['userId']).toBe('u1');
  });

  it('logStructured() omits data field when no data provided', () => {
    service.logStructured('warn', 'no data');
    const [, , meta] = winstonLogger.log.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(meta).not.toHaveProperty(LOG_FIELDS.DATA);
  });

  it('all log methods propagate request-context fields', () => {
    service.log('msg');
    const [, meta] = winstonLogger.info.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta[LOG_FIELDS.CORRELATION_ID]).toBe('corr-123');
    expect(meta[LOG_FIELDS.REQUEST_ID]).toBe('req-456');
    expect(meta[LOG_FIELDS.USER_ID]).toBe('GUSER');
  });

  it('LOG_FIELDS.SERVICE constant equals expected service name', () => {
    expect(SERVICE_NAME).toBe('myfans-backend');
  });

  it('redacts sensitive fields in object messages', () => {
    service.log({ password: 'secret123', username: 'alice' }, 'TestCtx');
    expect(mockWinston.info).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED]'),
      expect.objectContaining({ context: 'TestCtx' }),
    );
    // Verify secret is not in the logged message
    const [loggedMessage] = mockWinston.info.mock.calls[0];
    expect(loggedMessage).not.toContain('secret123');
    expect(loggedMessage).toContain('alice');
  });

  it('redacts sensitive fields in error messages with objects', () => {
    service.error({ authorization: 'Bearer token', action: 'login' }, undefined, 'TestCtx');
    const [loggedMessage] = mockWinston.error.mock.calls[0];
    expect(loggedMessage).toContain('[REDACTED]');
    expect(loggedMessage).not.toContain('Bearer token');
    expect(loggedMessage).toContain('login');
  });

  it('redacts sensitive fields in warn messages', () => {
    service.warn({ api_key: 'key-123', status: 'warning' }, 'TestCtx');
    const [loggedMessage] = mockWinston.warn.mock.calls[0];
    expect(loggedMessage).toContain('[REDACTED]');
    expect(loggedMessage).not.toContain('key-123');
  });

  it('redacts sensitive fields in debug messages', () => {
    service.debug({ email: 'user@example.com', userId: '123' }, 'TestCtx');
    const [loggedMessage] = mockWinston.debug.mock.calls[0];
    expect(loggedMessage).toContain('[REDACTED]');
    expect(loggedMessage).not.toContain('user@example.com');
  });

  it('redacts nested sensitive data in objects', () => {
    service.log(
      { user: { email: 'secret@example.com', name: 'Bob', wallet_address: 'GAB123' } },
      'TestCtx',
    );
    const [loggedMessage] = mockWinston.info.mock.calls[0];
    expect(loggedMessage).toContain('[REDACTED]');
    expect(loggedMessage).not.toContain('secret@example.com');
    expect(loggedMessage).not.toContain('GAB123');
    expect(loggedMessage).toContain('Bob');
  });

  it('does not redact string messages (trusted by caller)', () => {
    const message = 'User logged in successfully';
    service.log(message, 'TestCtx');
    expect(mockWinston.info).toHaveBeenCalledWith(message, expect.any(Object));
  });

  it('handles arrays of objects with sensitive fields', () => {
    service.log(
      [
        { password: 'p1', name: 'a' },
        { password: 'p2', name: 'b' },
      ],
      'TestCtx',
    );
    const [loggedMessage] = mockWinston.info.mock.calls[0];
    expect(loggedMessage).toContain('[REDACTED]');
    expect(loggedMessage).not.toContain('p1');
    expect(loggedMessage).not.toContain('p2');
    expect(loggedMessage).toContain('a');
    expect(loggedMessage).toContain('b');
  });
});

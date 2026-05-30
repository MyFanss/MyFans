import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { LoggerService } from './logger.service';
import { RequestContextService } from './request-context.service';

const mockWinston = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  log: jest.fn(),
};

describe('LoggerService', () => {
  let service: LoggerService;
  let requestContextService: RequestContextService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        RequestContextService,
        { provide: WINSTON_MODULE_PROVIDER, useValue: mockWinston },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
    requestContextService = module.get<RequestContextService>(RequestContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('log() calls winston.info with message and context meta', () => {
    service.log('hello', 'TestCtx');
    expect(mockWinston.info).toHaveBeenCalledWith('hello', expect.objectContaining({ context: 'TestCtx' }));
  });

  it('warn() calls winston.warn', () => {
    service.warn('watch out', 'TestCtx');
    expect(mockWinston.warn).toHaveBeenCalledWith('watch out', expect.objectContaining({ context: 'TestCtx' }));
  });

  it('error() calls winston.error and includes trace when provided', () => {
    service.error('boom', 'stack trace', 'TestCtx');
    expect(mockWinston.error).toHaveBeenCalledWith(
      'boom',
      expect.objectContaining({ context: 'TestCtx', trace: 'stack trace' }),
    );
  });

  it('error() omits trace key when trace is undefined', () => {
    service.error('boom', undefined, 'TestCtx');
    const meta = mockWinston.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta).not.toHaveProperty('trace');
  });

  it('debug() calls winston.debug', () => {
    service.debug('dbg', 'TestCtx');
    expect(mockWinston.debug).toHaveBeenCalledWith('dbg', expect.objectContaining({ context: 'TestCtx' }));
  });

  it('verbose() calls winston.verbose', () => {
    service.verbose('vrb', 'TestCtx');
    expect(mockWinston.verbose).toHaveBeenCalledWith('vrb', expect.objectContaining({ context: 'TestCtx' }));
  });

  it('includes correlationId and requestId from request context in meta', () => {
    requestContextService.run(
      {
        correlationId: 'cid-test',
        requestId: 'rid-test',
        method: 'GET',
        url: '/test',
        ip: '127.0.0.1',
        userId: null,
      },
      () => {
        service.log('in-context', 'Ctx');
        expect(mockWinston.info).toHaveBeenCalledWith(
          'in-context',
          expect.objectContaining({ correlationId: 'cid-test', requestId: 'rid-test' }),
        );
      },
    );
  });

  it('logStructured() calls winston.log with level and redacted data', () => {
    service.logStructured('info', 'structured msg', { password: 'secret', action: 'test' }, 'Ctx');
    expect(mockWinston.log).toHaveBeenCalledWith(
      'info',
      'structured msg',
      expect.objectContaining({
        context: 'Ctx',
        data: expect.objectContaining({ password: '[REDACTED]', action: 'test' }),
      }),
    );
  });

  it('logStructured() omits data key when data is undefined', () => {
    service.logStructured('warn', 'no data', undefined, 'Ctx');
    const meta = mockWinston.log.mock.calls[0][2] as Record<string, unknown>;
    expect(meta).not.toHaveProperty('data');
  });

  it('defaults context to "Application" when not provided', () => {
    service.log('no ctx');
    expect(mockWinston.info).toHaveBeenCalledWith('no ctx', expect.objectContaining({ context: 'Application' }));
  });

  it('serialises non-string messages to JSON', () => {
    service.log({ foo: 'bar' });
    expect(mockWinston.info).toHaveBeenCalledWith('{"foo":"bar"}', expect.any(Object));
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

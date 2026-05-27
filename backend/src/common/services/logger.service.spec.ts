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
});

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
});

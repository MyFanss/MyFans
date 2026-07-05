import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ExampleController } from './example.controller';
import { LoggerService } from '../services/logger.service';
import { RequestContextService } from '../services/request-context.service';

type MockLoggerService = Pick<LoggerService, 'log' | 'error' | 'logStructured'>;

type MockRequestContextService = Pick<
  RequestContextService,
  'getCorrelationId' | 'getRequestId' | 'getLogContext'
>;

describe('ExampleController', () => {
  let controller: ExampleController;
  let logger: jest.Mocked<MockLoggerService>;
  let requestContextService: jest.Mocked<MockRequestContextService>;

  beforeEach(async () => {
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      logStructured: jest.fn(),
    };

    requestContextService = {
      getCorrelationId: jest.fn().mockReturnValue('corr-123'),
      getRequestId: jest.fn().mockReturnValue('req-456'),
      getLogContext: jest.fn().mockReturnValue({
        correlationId: 'corr-123',
        requestId: 'req-456',
        method: 'GET',
        url: '/v1/example',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExampleController],
      providers: [
        { provide: LoggerService, useValue: logger },
        { provide: RequestContextService, useValue: requestContextService },
      ],
    }).compile();

    controller = module.get(ExampleController);
  });

  it('returns context identifiers and writes structured happy-path logs', () => {
    const response = controller.getExample({} as Request);

    expect(response).toEqual({
      message: 'Example response',
      correlationId: 'corr-123',
      requestId: 'req-456',
    });

    expect(logger.log).toHaveBeenCalledWith(
      'Processing example request',
      'ExampleController',
    );
    const structuredLogCall = logger.logStructured.mock.calls[0];
    expect(structuredLogCall).toBeDefined();
    expect(structuredLogCall[0]).toBe('info');
    expect(structuredLogCall[1]).toBe('Example request processed');
    expect(structuredLogCall[2]).toMatchObject({ action: 'get_example' });
    expect(
      typeof (structuredLogCall[2] as { timestamp?: unknown }).timestamp,
    ).toBe('string');
    expect(structuredLogCall[3]).toBe('ExampleController');
    expect(logger.log).toHaveBeenCalledWith(
      'Request context: {"correlationId":"corr-123","requestId":"req-456","method":"GET","url":"/v1/example"}',
      'ExampleController',
    );
    expect(requestContextService.getCorrelationId).toHaveBeenCalledTimes(1);
    expect(requestContextService.getRequestId).toHaveBeenCalledTimes(1);
  });

  it('logs structured error details before surfacing the failure', () => {
    expect(() => controller.getError()).toThrow('Test error');

    expect(logger.error).toHaveBeenCalledWith(
      'This is a test error',
      '',
      'ExampleController',
    );
    expect(logger.logStructured).toHaveBeenCalledWith(
      'error',
      'Test error occurred',
      { error: 'Test error', details: 'This is a test error message' },
      'ExampleController',
    );
  });
});

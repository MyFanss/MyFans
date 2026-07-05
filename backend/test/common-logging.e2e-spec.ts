import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  RequestMethod,
  VersioningType,
  Logger,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { CorrelationIdMiddleware } from '../src/common/middleware/correlation-id.middleware';
import { LoggingMiddleware } from '../src/common/middleware/logging.middleware';
import { RequestContextService } from '../src/common/services/request-context.service';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    CorrelationIdMiddleware,
    LoggingMiddleware,
    RequestContextService,
  ],
})
class CommonLoggingE2eModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

describe('Common logging (e2e)', () => {
  let app: INestApplication<App>;
  let logSpy: jest.SpiedFunction<Logger['log']>;
  let warnSpy: jest.SpiedFunction<Logger['warn']>;
  let errorSpy: jest.SpiedFunction<Logger['error']>;

  beforeEach(async () => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CommonLoggingE2eModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('logs the primary endpoint request and response with request IDs', async () => {
    const correlationId = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
    const requestId = 'b2c3d4e5-f6a7-4890-9bcd-ef0123456789';

    await request(app.getHttpServer())
      .get('/v1')
      .set('x-correlation-id', correlationId)
      .set('x-request-id', requestId)
      .expect(200)
      .expect('x-correlation-id', correlationId)
      .expect('x-request-id', requestId)
      .expect('Hello World!');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    const logMessages = logSpy.mock.calls.map(([message]) => String(message));

    expect(
      logMessages.some(
        (message) =>
          message.includes(`[${correlationId}] [${requestId}]`) &&
          message.includes('Incoming Request: GET /v1'),
      ),
    ).toBe(true);

    expect(
      logMessages.some(
        (message) =>
          message.includes(`[${correlationId}] [${requestId}]`) &&
          message.includes('Outgoing Response: GET /v1 - Status: 200') &&
          message.includes('Body: "Hello World!"'),
      ),
    ).toBe(true);
  });
});

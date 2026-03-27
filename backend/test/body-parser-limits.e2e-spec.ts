import { Body, Controller, INestApplication, Module, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { configureBodyParserLimits } from '../src/common/http/body-parser.config';

@Controller()
class PayloadController {
  @Post('payload')
  handlePayload(@Body() body: { data: string }) {
    return { received: body.data.length };
  }

  @Post('v1/webhook')
  handleWebhook(@Body() body: { data: string }) {
    return { received: body.data.length };
  }
}

@Module({
  controllers: [PayloadController],
})
class PayloadTestModule {}

describe('Body parser limits (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PayloadTestModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureBodyParserLimits(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts normal payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/payload')
      .send({ data: 'safe-body' })
      .expect(201);

    expect(response.body).toEqual({ received: 9 });
  });

  it('rejects oversized payloads with explicit 413 error', async () => {
    const oversized = 'a'.repeat(120 * 1024);

    const response = await request(app.getHttpServer())
      .post('/payload')
      .send({ data: oversized })
      .expect(413);

    expect(response.body).toEqual({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'Payload too large. Maximum request body size is 100kb.',
    });
  });

  it('allows larger payloads on webhook override endpoint', async () => {
    const webhookSizedPayload = 'a'.repeat(200 * 1024);

    const response = await request(app.getHttpServer())
      .post('/v1/webhook')
      .send({ data: webhookSizedPayload })
      .expect(201);

    expect(response.body).toEqual({ received: 200 * 1024 });
  });
});

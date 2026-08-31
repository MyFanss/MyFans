import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookAuditService } from './webhook-audit.service';
import { WebhookEventProcessorService } from './webhook-event-processor.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: WebhookService;
  let auditService: WebhookAuditService;
  let processorService: WebhookEventProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            rotate: jest.fn(),
            expirePrevious: jest.fn(),
            getState: jest.fn().mockReturnValue({
              active: 'new-secret',
              previous: 'old-secret',
              cutoffAt: Date.now() + 24 * 60 * 60 * 1000,
            }),
          },
        },
        {
          provide: WebhookAuditService,
          useValue: {
            logRotation: jest.fn().mockResolvedValue(undefined),
            logExpirePrevious: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WebhookEventProcessorService,
          useValue: {
            processEvent: jest.fn().mockResolvedValue({
              processed: true,
              eventId: 'evt-123',
              eventType: 'subscription.created',
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get<WebhookService>(WebhookService);
    auditService = module.get<WebhookAuditService>(WebhookAuditService);
    processorService = module.get<WebhookEventProcessorService>(
      WebhookEventProcessorService,
    );
  });

  describe('receive', () => {
    it('processes webhook event and returns processing result', async () => {
      const payload = {
        id: 'evt-123',
        type: 'subscription.created',
        timestamp: Date.now(),
        data: {
          fan: 'fan-addr',
          creator: 'creator-addr',
          planId: 1,
          expiry: 1234567890,
        },
      };

      const result = await controller.receive(payload);

      expect(processorService.processEvent).toHaveBeenCalledWith(payload);
      expect(result).toEqual({
        received: true,
        processed: true,
        eventId: 'evt-123',
        eventType: 'subscription.created',
      });
    });

    it('handles processing errors gracefully', async () => {
      const payload = { invalid: 'data' };
      (processorService.processEvent as jest.Mock).mockResolvedValue({
        processed: false,
        error: 'Invalid event format',
      });

      const result = await controller.receive(payload);

      expect(result).toEqual({
        received: true,
        processed: false,
        error: 'Invalid event format',
      });
    });
  });

  describe('rotate', () => {
    it('rotates the webhook secret and logs audit entry', async () => {
      const body = {
        newSecret: 'new-secret-value',
        cutoffMs: 12 * 60 * 60 * 1000,
      };
      const adminUser = { id: 'admin-123' };

      const result = await controller.rotate(body, adminUser);

      expect(webhookService.rotate).toHaveBeenCalledWith(
        'new-secret-value',
        12 * 60 * 60 * 1000,
      );
      expect(auditService.logRotation).toHaveBeenCalledWith(
        'admin-123',
        12 * 60 * 60 * 1000,
      );
      expect(result).toEqual({
        rotated: true,
        cutoffAt: expect.any(Number),
        hasPrevious: true,
      });
    });

    it('rotates with default cutoff when not specified', async () => {
      const body = { newSecret: 'new-secret-value' };
      const adminUser = { id: 'admin-456' };

      await controller.rotate(body, adminUser);

      expect(webhookService.rotate).toHaveBeenCalledWith(
        'new-secret-value',
        undefined,
      );
      expect(auditService.logRotation).toHaveBeenCalledWith(
        'admin-456',
        undefined,
      );
    });
  });

  describe('expirePrevious', () => {
    it('expires the previous secret and logs audit entry', async () => {
      const adminUser = { id: 'admin-789' };

      const result = await controller.expirePrevious(adminUser);

      expect(webhookService.expirePrevious).toHaveBeenCalled();
      expect(auditService.logExpirePrevious).toHaveBeenCalledWith('admin-789');
      expect(result).toEqual({ expired: true });
    });
  });
});

describe('WebhookController - Admin Guard Protection', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            rotate: jest.fn(),
            expirePrevious: jest.fn(),
            getState: jest.fn().mockReturnValue({
              active: 'new-secret',
              previous: 'old-secret',
              cutoffAt: Date.now() + 24 * 60 * 60 * 1000,
            }),
          },
        },
        {
          provide: WebhookAuditService,
          useValue: {
            logRotation: jest.fn().mockResolvedValue(undefined),
            logExpirePrevious: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: WebhookEventProcessorService,
          useValue: {
            processEvent: jest.fn().mockResolvedValue({
              processed: true,
              eventId: 'evt-123',
              eventType: 'subscription.created',
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => false })
      .compile();

    app = module.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 403 for rotate endpoint without admin role', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhook/rotate')
      .send({ newSecret: 'secret' })
      .expect(403);
  });

  it('returns 403 for expire-previous endpoint without admin role', async () => {
    await request(app.getHttpServer())
      .post('/v1/webhook/expire-previous')
      .expect(403);
  });
});

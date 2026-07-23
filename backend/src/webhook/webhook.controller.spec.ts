import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookAuditService } from './webhook-audit.service';
import { UserRole } from '../common/enums/user-role.enum';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: WebhookService;
  let auditService: WebhookAuditService;

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
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get<WebhookService>(WebhookService);
    auditService = module.get<WebhookAuditService>(WebhookAuditService);
  });

  describe('receive', () => {
    it('returns received: true', () => {
      const payload = { event: 'test.event', data: {} };
      const result = controller.receive(payload);

      expect(result).toEqual({ received: true, payload });
    });
  });

  describe('rotate', () => {
    it('rotates the webhook secret and logs audit entry', async () => {
      const body = { newSecret: 'new-secret-value', cutoffMs: 12 * 60 * 60 * 1000 };
      const adminUser = { id: 'admin-123' };

      const result = await controller.rotate(body, adminUser);

      expect(webhookService.rotate).toHaveBeenCalledWith(
        'new-secret-value',
        12 * 60 * 60 * 1000,
      );
      expect(auditService.logRotation).toHaveBeenCalledWith('admin-123', 12 * 60 * 60 * 1000);
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

      expect(webhookService.rotate).toHaveBeenCalledWith('new-secret-value', undefined);
      expect(auditService.logRotation).toHaveBeenCalledWith('admin-456', undefined);
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
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 403 for rotate endpoint without admin role', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhook/rotate',
      payload: { newSecret: 'secret' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 403 for expire-previous endpoint without admin role', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhook/expire-previous',
    });

    expect(response.statusCode).toBe(403);
  });
});

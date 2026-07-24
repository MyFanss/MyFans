import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEventProcessorService } from './webhook-event-processor.service';
import { WebhookProcessedEvent } from './entities/webhook-processed-event.entity';
import { EventBus } from '../events/event-bus';
import { SubscriptionCreatedEvent } from '../events/domain-events';

describe('WebhookEventProcessorService', () => {
  let service: WebhookEventProcessorService;
  let repository: Repository<WebhookProcessedEvent>;
  let eventBus: EventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEventProcessorService,
        {
          provide: getRepositoryToken(WebhookProcessedEvent),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: EventBus,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookEventProcessorService>(
      WebhookEventProcessorService,
    );
    repository = module.get<Repository<WebhookProcessedEvent>>(
      getRepositoryToken(WebhookProcessedEvent),
    );
    eventBus = module.get<EventBus>(EventBus);
  });

  describe('processEvent', () => {
    it('processes a known event type and publishes domain event', async () => {
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

      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.save as jest.Mock).mockResolvedValue({});

      const result = await service.processEvent(payload);

      expect(result.processed).toBe(true);
      expect(result.eventId).toBe('evt-123');
      expect(result.eventType).toBe('subscription.created');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.any(SubscriptionCreatedEvent),
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('does not process duplicate events (idempotency)', async () => {
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

      (repository.findOne as jest.Mock).mockResolvedValue({
        id: 'processed-id',
        event_id: 'evt-123',
      });

      const result = await service.processEvent(payload);

      expect(result.processed).toBe(true);
      expect(result.eventId).toBe('evt-123');
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('logs unknown event types safely without publishing', async () => {
      const payload = {
        id: 'evt-456',
        type: 'custom.unknown_event',
        timestamp: Date.now(),
        data: {},
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.save as jest.Mock).mockResolvedValue({});

      const result = await service.processEvent(payload);

      expect(result.processed).toBe(true);
      expect(result.eventType).toBe('custom.unknown_event');
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('returns error for invalid event format', async () => {
      const result = await service.processEvent({ invalid: 'payload' });

      expect(result.processed).toBe(false);
      expect(result.error).toBe('Invalid event format');
    });

    it('handles missing event data gracefully', async () => {
      const result = await service.processEvent(null);

      expect(result.processed).toBe(false);
    });

    it('handles event processing errors gracefully', async () => {
      const payload = {
        id: 'evt-789',
        type: 'subscription.created',
        timestamp: Date.now(),
        data: {
          fan: 'fan-addr',
          creator: 'creator-addr',
          planId: 'invalid', // Invalid: should be number
          expiry: 1234567890,
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (eventBus.publish as jest.Mock).mockImplementation(() => {
        throw new Error('Event bus error');
      });

      const result = await service.processEvent(payload);

      expect(result.processed).toBe(false);
      expect(result.error).toContain('Event bus error');
    });
  });

  describe('subscription events', () => {
    it('dispatches subscription.renewed events', async () => {
      const payload = {
        id: 'evt-renewed',
        type: 'subscription.renewed',
        timestamp: Date.now(),
        data: {
          subscriptionId: 'sub-123',
          fan: 'fan-addr',
          creator: 'creator-addr',
          planId: 2,
          expiry: 1234567890,
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.processEvent(payload);

      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('dispatches subscription.cancelled events', async () => {
      const payload = {
        id: 'evt-cancelled',
        type: 'subscription.cancelled',
        timestamp: Date.now(),
        data: {
          subscriptionId: 'sub-456',
          fan: 'fan-addr',
          creator: 'creator-addr',
          planId: 1,
          cancelledAt: 1234567890,
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.processEvent(payload);

      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('dispatches subscription.expired events', async () => {
      const payload = {
        id: 'evt-expired',
        type: 'subscription.expired',
        timestamp: Date.now(),
        data: {
          fan: 'fan-addr',
          creator: 'creator-addr',
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.processEvent(payload);

      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('dispatches subscription.renewal_failed events', async () => {
      const payload = {
        id: 'evt-renewal-failed',
        type: 'subscription.renewal_failed',
        timestamp: Date.now(),
        data: {
          subscriptionId: 'sub-789',
          fan: 'fan-addr',
          creator: 'creator-addr',
          planId: 1,
          reason: 'Insufficient balance',
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.processEvent(payload);

      expect(eventBus.publish).toHaveBeenCalled();
    });
  });

  describe('creator and post events', () => {
    it('dispatches creator.plan_created events', async () => {
      const payload = {
        id: 'evt-plan-created',
        type: 'creator.plan_created',
        timestamp: Date.now(),
        data: {
          planId: 5,
          creator: 'creator-addr',
          asset: 'native',
          amount: '10.00',
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.processEvent(payload);

      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('dispatches post.deleted events', async () => {
      const payload = {
        id: 'evt-post-deleted',
        type: 'post.deleted',
        timestamp: Date.now(),
        data: {
          postId: 'post-123',
          deletedBy: 'admin-id',
        },
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await service.processEvent(payload);

      expect(eventBus.publish).toHaveBeenCalled();
    });
  });
});

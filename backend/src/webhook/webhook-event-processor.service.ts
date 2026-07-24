import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventBus } from '../events/event-bus';
import {
  SubscriptionCreatedEvent,
  SubscriptionRenewedEvent,
  SubscriptionCancelledEvent,
  SubscriptionExpiredEvent,
  SubscriptionRenewalFailedEvent,
  PlanCreatedEvent,
  PostDeletedEvent,
  UserLoggedInEvent,
} from '../events/domain-events';
import { WebhookEvent, KNOWN_EVENT_TYPES } from './webhook-event';
import { WebhookProcessedEvent } from './entities/webhook-processed-event.entity';

@Injectable()
export class WebhookEventProcessorService {
  private readonly logger = new Logger(WebhookEventProcessorService.name);

  constructor(
    private readonly eventBus: EventBus,
    @InjectRepository(WebhookProcessedEvent)
    private readonly processedEventRepo: Repository<WebhookProcessedEvent>,
  ) {}

  async processEvent(payload: unknown): Promise<{
    processed: boolean;
    eventId?: string;
    eventType?: string;
    error?: string;
  }> {
    try {
      const event = this.parseEvent(payload);

      if (!event) {
        this.logger.warn('Failed to parse webhook event');
        return { processed: false, error: 'Invalid event format' };
      }

      // Check idempotency
      const alreadyProcessed = await this.isEventProcessed(event.id);
      if (alreadyProcessed) {
        this.logger.debug(`Event already processed: ${event.id}`);
        return {
          processed: true,
          eventId: event.id,
          eventType: event.type,
        };
      }

      // Validate event type
      if (!KNOWN_EVENT_TYPES.has(event.type)) {
        this.logger.warn(`Unknown event type: ${event.type}, logging safely`);
        await this.markEventProcessed(event.id, event.type);
        return {
          processed: true,
          eventId: event.id,
          eventType: event.type,
        };
      }

      // Dispatch to appropriate handler
      await this.dispatchEvent(event);
      await this.markEventProcessed(event.id, event.type);

      return {
        processed: true,
        eventId: event.id,
        eventType: event.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing webhook event: ${errorMessage}`, error);
      return { processed: false, error: errorMessage };
    }
  }

  private parseEvent(payload: unknown): WebhookEvent | null {
    try {
      if (typeof payload !== 'object' || payload === null) {
        return null;
      }

      const obj = payload as Record<string, unknown>;
      const { id, type, timestamp, data } = obj;

      if (
        typeof id !== 'string' ||
        typeof type !== 'string' ||
        typeof timestamp !== 'number' ||
        typeof data !== 'object' ||
        data === null
      ) {
        return null;
      }

      return {
        id,
        type,
        timestamp,
        data: data as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    const record = await this.processedEventRepo.findOne({
      where: { event_id: eventId },
    });
    return !!record;
  }

  private async markEventProcessed(
    eventId: string,
    eventType: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.processedEventRepo.save({
        event_id: eventId,
        event_type: eventType,
        error_message: errorMessage || null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark event processed: ${eventId}`,
        error,
      );
    }
  }

  private async dispatchEvent(event: WebhookEvent): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case 'subscription.created':
        this.eventBus.publish(
          new SubscriptionCreatedEvent(
            String(data.fan),
            String(data.creator),
            Number(data.planId),
            Number(data.expiry),
            Number(data.timestamp),
          ),
        );
        break;

      case 'subscription.renewed':
        this.eventBus.publish(
          new SubscriptionRenewedEvent(
            String(data.subscriptionId),
            String(data.fan),
            String(data.creator),
            Number(data.planId),
            Number(data.expiry),
            Number(data.timestamp),
          ),
        );
        break;

      case 'subscription.cancelled':
        this.eventBus.publish(
          new SubscriptionCancelledEvent(
            String(data.subscriptionId),
            String(data.fan),
            String(data.creator),
            Number(data.planId),
            Number(data.cancelledAt),
            Number(data.timestamp),
          ),
        );
        break;

      case 'subscription.expired':
        this.eventBus.publish(
          new SubscriptionExpiredEvent(
            String(data.fan),
            String(data.creator),
            Number(data.timestamp),
          ),
        );
        break;

      case 'subscription.renewal_failed':
        this.eventBus.publish(
          new SubscriptionRenewalFailedEvent(
            String(data.subscriptionId),
            String(data.fan),
            String(data.creator),
            Number(data.planId),
            data.reason ? String(data.reason) : undefined,
            Number(data.timestamp),
          ),
        );
        break;

      case 'creator.plan_created':
        this.eventBus.publish(
          new PlanCreatedEvent(
            Number(data.planId),
            String(data.creator),
            String(data.asset),
            String(data.amount),
            Number(data.timestamp),
          ),
        );
        break;

      case 'post.deleted':
        this.eventBus.publish(
          new PostDeletedEvent(
            String(data.postId),
            String(data.deletedBy),
            Number(data.timestamp),
          ),
        );
        break;

      case 'user.logged_in':
        this.eventBus.publish(
          new UserLoggedInEvent(
            String(data.userId),
            String(data.stellarAddress),
            Number(data.timestamp),
          ),
        );
        break;

      case 'payment.completed':
      case 'payment.failed':
        this.logger.debug(`Event ${type} received but no handler configured`);
        break;

      default:
        this.logger.warn(`Unknown event type: ${type}`);
    }
  }
}

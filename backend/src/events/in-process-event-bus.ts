import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from './event-bus';
import { DomainEvent } from './domain-events';

@Injectable()
export class InProcessEventBus extends EventBus {
  private readonly logger = new Logger(InProcessEventBus.name);
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => void>>();
  private readonly publishedCountByType = new Map<string, number>();
  private publishedTotal = 0;

  publish<T extends DomainEvent>(event: T): void {
    this.logger.debug(`Publishing event: ${event.type}`);
    this.publishedTotal++;
    this.publishedCountByType.set(
      event.type,
      (this.publishedCountByType.get(event.type) ?? 0) + 1,
    );
    const eventHandlers = this.handlers.get(event.type) ?? [];
    for (const handler of eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        this.logger.error(`Handler error for ${event.type}: ${err.message}`);
      }
    }
  }

  getMetrics() {
    return {
      events_published_total: this.publishedTotal,
      events_by_type: Object.fromEntries(this.publishedCountByType),
    };
  }

  subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler as (event: DomainEvent) => void]);
  }
}

import { DomainEvent } from './domain-events';

export abstract class EventBus {
  abstract publish<T extends DomainEvent>(event: T): void;
  abstract subscribe<T extends DomainEvent>(
    eventType: T['type'],
    handler: (event: T) => void,
  ): void;
}

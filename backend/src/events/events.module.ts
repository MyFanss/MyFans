import { Module } from '@nestjs/common';
import { EventBus } from './event-bus';
import { InProcessEventBus } from './in-process-event-bus';

@Module({
  providers: [{ provide: EventBus, useClass: InProcessEventBus }],
  exports: [EventBus],
})
export class EventsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';
import { WebhookAuditService } from './webhook-audit.service';
import { WebhookEventProcessorService } from './webhook-event-processor.service';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';
import { WebhookProcessedEvent } from './entities/webhook-processed-event.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookAuditLog, WebhookProcessedEvent]),
    EventsModule,
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookGuard,
    WebhookAuditService,
    WebhookEventProcessorService,
  ],
  exports: [WebhookService],
})
export class WebhookModule {}

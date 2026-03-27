import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookGuard],
  exports: [WebhookService],
})
export class WebhookModule {}

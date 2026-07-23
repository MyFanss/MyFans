import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';
import { WebhookAuditService } from './webhook-audit.service';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookAuditLog])],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookGuard, WebhookAuditService],
  exports: [WebhookService],
})
export class WebhookModule {}

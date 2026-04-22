import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, WebhookGuard],
  exports: [WebhookService],
})
export class WebhookModule {}

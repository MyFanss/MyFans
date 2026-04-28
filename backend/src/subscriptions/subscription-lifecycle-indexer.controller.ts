import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SubscriptionIndexerEventDto } from './dto/subscription-indexer-event.dto';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';

@Controller({ path: 'subscriptions/indexer-events', version: '1' })
export class SubscriptionLifecycleIndexerController {
  constructor(
    private readonly subscriptionLifecycleIndexerService: SubscriptionLifecycleIndexerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(@Body() event: SubscriptionIndexerEventDto) {
    this.subscriptionLifecycleIndexerService.handleEvent(event);
    return { accepted: true };
  }
}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionIndexerEventDto } from './dto/subscription-indexer-event.dto';
import { SubscriptionLifecycleIndexerService } from './subscription-lifecycle-indexer.service';

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions/indexer-events', version: '1' })
export class SubscriptionLifecycleIndexerController {
  constructor(
    private readonly subscriptionLifecycleIndexerService: SubscriptionLifecycleIndexerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ingest a subscription lifecycle event from the chain indexer',
    description:
      'Accepts renew / cancel / renewal-failed events emitted by the off-chain ' +
      'subscription indexer and fans them out to notifications and read models.',
  })
  @ApiResponse({ status: 202, description: 'Event accepted for processing' })
  @ApiResponse({ status: 400, description: 'Malformed indexer event payload' })
  ingest(@Body() event: SubscriptionIndexerEventDto) {
    this.subscriptionLifecycleIndexerService.handleEvent(event);
    return { accepted: true };
  }
}

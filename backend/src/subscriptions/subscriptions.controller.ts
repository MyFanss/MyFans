import { Controller, Get, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('check')
  checkSubscription(@Query('fan') fan: string, @Query('creator') creator: string) {
    return { isSubscriber: this.subscriptionsService.isSubscriber(fan, creator) };
  }
}

import { Controller, Post, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { RequireFeatureFlag } from '../feature-flags/feature-flag.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  @Post('new-flow')
  @UseGuards(FeatureFlagGuard)
  @RequireFeatureFlag('newSubscriptionFlow')
  createWithNewFlow() {
    return { message: 'New subscription flow' };
  }

  @Post('crypto-payment')
  @UseGuards(FeatureFlagGuard)
  @RequireFeatureFlag('cryptoPayments')
  payWithCrypto() {
    return { message: 'Crypto payment flow' };
  }
}

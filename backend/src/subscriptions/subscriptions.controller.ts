import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { SubscriptionStateQueryDto } from './dto/subscription-state-query.dto';
import { FanBearerGuard, RequestWithFan } from './guards/fan-bearer.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('me/subscription-state')
  @UseGuards(FanBearerGuard)
  async getFanCreatorSubscriptionState(
    @Req() req: RequestWithFan,
    @Query() query: SubscriptionStateQueryDto,
  ) {
    return this.subscriptionsService.getFanCreatorSubscriptionState(
      req.fanAddress,
      query.creator,
    );
  }

  @Get('check')
  checkSubscription(@Query('fan') fan: string, @Query('creator') creator: string) {
    return { isSubscriber: this.subscriptionsService.isSubscriber(fan, creator) };
  }

  @Get('list')
  listSubscriptions(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.listSubscriptions(
      query.fan,
      query.status,
      query.sort,
      query.page,
      query.limit,
    );
  }

  @Post('checkout')
  createCheckout(
    @Body()
    body: {
      fanAddress: string;
      creatorAddress: string;
      planId: number;
      assetCode?: string;
      assetIssuer?: string;
    },
    @Headers('x-network') requestNetwork?: string,
  ) {
    const checkout = this.subscriptionsService.createCheckout(
      body.fanAddress,
      body.creatorAddress,
      body.planId,
      body.assetCode,
      body.assetIssuer,
      requestNetwork,
    );

    return {
      id: checkout.id,
      fanAddress: checkout.fanAddress,
      creatorAddress: checkout.creatorAddress,
      planId: checkout.planId,
      assetCode: checkout.assetCode,
      assetIssuer: checkout.assetIssuer,
      amount: checkout.amount,
      fee: checkout.fee,
      total: checkout.total,
      status: checkout.status,
      expiresAt: checkout.expiresAt,
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt,
    };
  }

  @Get('checkout/:id')
  getCheckout(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return {
      id: checkout.id,
      fanAddress: checkout.fanAddress,
      creatorAddress: checkout.creatorAddress,
      planId: checkout.planId,
      assetCode: checkout.assetCode,
      assetIssuer: checkout.assetIssuer,
      amount: checkout.amount,
      fee: checkout.fee,
      total: checkout.total,
      status: checkout.status,
      expiresAt: checkout.expiresAt,
      txHash: checkout.txHash,
      error: checkout.error,
      createdAt: checkout.createdAt,
      updatedAt: checkout.updatedAt,
    };
  }

  @Get('checkout/:id/plan')
  getPlanSummary(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getPlanSummary(checkout.planId);
  }

  @Get('checkout/:id/price')
  getPriceBreakdown(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getPriceBreakdown(checkoutId);
  }

  @Get('checkout/:id/wallet')
  getWalletStatus(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getWalletStatus(checkout.fanAddress);
  }

  @Get('checkout/:id/preview')
  getTransactionPreview(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getTransactionPreview(checkoutId);
  }

  @Post('checkout/:id/validate')
  validateBalance(
    @Param('id') checkoutId: string,
    @Body() body: { assetCode: string; amount: string },
  ) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.validateBalance(
      checkout.fanAddress,
      body.assetCode,
      body.amount,
    );
  }

  @Post('checkout/:id/confirm')
  confirmSubscription(
    @Param('id') checkoutId: string,
    @Body() body: { txHash?: string },
  ) {
    return this.subscriptionsService.confirmSubscription(checkoutId, body.txHash);
  }

  @Post('checkout/:id/fail')
  failCheckout(
    @Param('id') checkoutId: string,
    @Body() body: { error: string; rejected?: boolean },
  ) {
    return this.subscriptionsService.failCheckout(
      checkoutId,
      body.error,
      body.rejected,
    );
  }

  @Post('cancel')
  cancelSubscription(
    @Body() body: { fanAddress: string; creatorAddress: string },
  ) {
    return this.subscriptionsService.cancelSubscription(
      body.fanAddress,
      body.creatorAddress,
    );
  }
}

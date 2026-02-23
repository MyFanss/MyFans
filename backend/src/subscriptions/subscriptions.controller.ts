import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('check')
  checkSubscription(@Query('fan') fan: string, @Query('creator') creator: string) {
    return { isSubscriber: this.subscriptionsService.isSubscriber(fan, creator) };
  }

  /**
   * Create a new checkout session
   */
  @Post('checkout')
  createCheckout(
    @Body() body: {
      fanAddress: string;
      creatorAddress: string;
      planId: number;
      assetCode?: string;
      assetIssuer?: string;
    },
  ) {
    const checkout = this.subscriptionsService.createCheckout(
      body.fanAddress,
      body.creatorAddress,
      body.planId,
      body.assetCode,
      body.assetIssuer,
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

  /**
   * Get checkout details
   */
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

  /**
   * Get plan summary
   */
  @Get('checkout/:id/plan')
  getPlanSummary(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getPlanSummary(checkout.planId);
  }

  /**
   * Get price breakdown
   */
  @Get('checkout/:id/price')
  getPriceBreakdown(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getPriceBreakdown(checkoutId);
  }

  /**
   * Get wallet status
   */
  @Get('checkout/:id/wallet')
  getWalletStatus(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getWalletStatus(checkout.fanAddress);
  }

  /**
   * Get transaction preview
   */
  @Get('checkout/:id/preview')
  getTransactionPreview(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getTransactionPreview(checkoutId);
  }

  /**
   * Validate balance
   */
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

  /**
   * Confirm subscription (success)
   */
  @Post('checkout/:id/confirm')
  confirmSubscription(
    @Param('id') checkoutId: string,
    @Body() body: { txHash?: string },
  ) {
    return this.subscriptionsService.confirmSubscription(
      checkoutId,
      body.txHash,
    );
  }

  /**
   * Handle checkout failure
   */
  @Post('checkout/:id/fail')
  failCheckout(
    @Param('id') checkoutId: string,
    @Body() body: { error: string; rejected?: boolean },
  ) {
    return this.subscriptionsService.failCheckout(checkoutId, body.error, body.rejected);
  }
}


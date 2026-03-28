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
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { ListCreatorSubscribersQueryDto } from './dto/list-creator-subscribers-query.dto';
import { SubscriptionStateQueryDto } from './dto/subscription-state-query.dto';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import type { RequestWithFan } from './guards/fan-bearer.guard';
import { SubscriptionsService } from './subscriptions.service';
import { Deprecated, DeprecationInterceptor } from '../common/deprecation';

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('me/subscription-state')
  @UseGuards(FanBearerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription state between the authenticated fan and a creator' })
  @ApiResponse({ status: 200, description: 'Subscription state' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @Deprecated({
    sunset: '2026-01-01',
    link: '/v1/subscriptions/me/subscription-state',
    message: 'Use GET /v1/subscriptions/me/subscription-state instead. Removal date: 2026-01-01.',
  })
  @UseInterceptors(new DeprecationInterceptor(new Reflector()))
  @ApiOperation({ summary: '[Deprecated] Check if a fan is subscribed to a creator', deprecated: true })
  @ApiResponse({ status: 200, description: 'Subscription check result' })
  checkSubscription(@Query('fan') fan: string, @Query('creator') creator: string) {
    return { isSubscriber: this.subscriptionsService.isSubscriber(fan, creator) };
  }

  @Get('list')
  @Deprecated({
    sunset: '2026-01-01',
    link: '/v1/subscriptions/me/subscription-state',
    message: 'Use GET /v1/subscriptions/me/subscription-state instead. Removal date: 2026-01-01.',
  })
  @UseInterceptors(new DeprecationInterceptor(new Reflector()))
  @ApiOperation({ summary: '[Deprecated] List subscriptions for a fan', deprecated: true })
  @ApiResponse({ status: 200, description: 'Subscriptions list' })
  listSubscriptions(@Query() query: ListSubscriptionsQueryDto) {
    return this.subscriptionsService.listSubscriptions(
      query.fan,
      query.status,
      query.sort,
      query.page,
      query.limit,
    );
  }

  @Get('creator-subscribers')
  listCreatorSubscribers(@Query() query: ListCreatorSubscribersQueryDto) {
    return this.subscriptionsService.listCreatorSubscribers(
      query.creator,
      query.status,
      query.page,
      query.limit,
    );
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create a subscription checkout session' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
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
  @ApiOperation({ summary: 'Get a checkout session by ID' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Checkout session details' })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
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
  @ApiOperation({ summary: 'Get plan summary for a checkout session' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Plan summary' })
  getPlanSummary(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getPlanSummary(checkout.planId);
  }

  @Get('checkout/:id/price')
  @ApiOperation({ summary: 'Get price breakdown for a checkout session' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Price breakdown' })
  getPriceBreakdown(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getPriceBreakdown(checkoutId);
  }

  @Get('checkout/:id/wallet')
  @ApiOperation({ summary: 'Get wallet status for a checkout session' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Wallet status' })
  getWalletStatus(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getWalletStatus(checkout.fanAddress);
  }

  @Get('checkout/:id/preview')
  @ApiOperation({ summary: 'Get transaction preview for a checkout session' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Transaction preview' })
  getTransactionPreview(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getTransactionPreview(checkoutId);
  }

  @Post('checkout/:id/validate')
  @ApiOperation({ summary: 'Validate fan wallet balance for a checkout session' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Balance validation result' })
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
  @ApiOperation({ summary: 'Confirm a subscription checkout' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Subscription confirmed' })
  confirmSubscription(
    @Param('id') checkoutId: string,
    @Body() body: { txHash?: string },
  ) {
    return this.subscriptionsService.confirmSubscription(checkoutId, body.txHash);
  }

  @Post('checkout/:id/fail')
  @ApiOperation({ summary: 'Mark a checkout session as failed' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Checkout marked as failed' })
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
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  cancelSubscription(
    @Body() body: { fanAddress: string; creatorAddress: string },
  ) {
    return this.subscriptionsService.cancelSubscription(
      body.fanAddress,
      body.creatorAddress,
    );
  }
}

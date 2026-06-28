import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { ListCreatorSubscribersQueryDto } from './dto/list-creator-subscribers-query.dto';
import { SubscriptionStateQueryDto } from './dto/subscription-state-query.dto';
import {
  CreateCheckoutDto,
  CheckoutResponseDto,
  ValidateBalanceDto,
  ValidateBalanceResponseDto,
  ConfirmSubscriptionDto,
  ConfirmSubscriptionResponseDto,
  FailCheckoutDto,
  CancelSubscriptionDto,
  PlanSummaryResponseDto,
  PriceBreakdownResponseDto,
  WalletStatusResponseDto,
  TransactionPreviewResponseDto,
} from './dto/checkout.dto';
import { FanBearerGuard } from './guards/fan-bearer.guard';
import type { RequestWithFan } from './guards/fan-bearer.guard';
import { SubscriptionsService } from './subscriptions.service';
import { RequireFeatureFlag } from '../feature-flags/feature-flag.decorator';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { Deprecated, DeprecationInterceptor } from '../common/deprecation';
import { SubscriptionsExceptionFilter } from './filters/subscriptions-exception.filter';

@ApiTags('subscriptions')
@UseFilters(new SubscriptionsExceptionFilter())
@UseGuards(ThrottlerGuard)
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
  async checkSubscription(@Query('fan') fan: string, @Query('creator') creator: string) {
    const isSubscriber = await this.subscriptionsService.isSubscriber(fan, creator);
    return { isSubscriber };
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
      query.status as never,
      query.sort,
      query.cursor,
      query.limit,
    );
  }

  @Get('me/list')
  @UseGuards(FanBearerGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List subscriptions for the authenticated fan with status and sort filters',
    description:
      'Cursor-paginated subscription list. Pass `cursor` and `limit`; responses include `data`, `limit`, `nextCursor`, and `hasMore`.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (`nextCursor` from the previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Cursor-paginated subscriptions list (`data`, `limit`, `nextCursor`, `hasMore`)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  listMySubscriptions(
    @Req() req: RequestWithFan,
    @Query() query: ListSubscriptionsQueryDto,
  ) {
    return this.subscriptionsService.listSubscriptions(
      req.fanAddress,
      query.status,
      query.sort,
      query.cursor,
      query.limit,
    );
  }

  @Get('creator-subscribers')
  @ApiOperation({
    summary: 'List subscribers for a creator',
    description:
      'Cursor-paginated subscriber list. Pass `cursor` and `limit`; responses include `data`, `limit`, `nextCursor`, and `hasMore`.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (`nextCursor` from the previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Cursor-paginated subscribers list (`data`, `limit`, `nextCursor`, `hasMore`)',
  })
  listCreatorSubscribers(@Query() query: ListCreatorSubscribersQueryDto) {
    return this.subscriptionsService.listCreatorSubscribers(
      query.creator,
      query.status,
      query.cursor,
      query.limit,
      query.sort,
    );
  }

  @Post('checkout')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @UseGuards(FeatureFlagGuard)
  @RequireFeatureFlag('newSubscriptionFlow')
  @ApiOperation({ summary: 'Create a subscription checkout session', description: 'Initiates a new checkout session for subscribing to a creator plan. The session expires after 15 minutes.' })
  @ApiResponse({ status: 201, description: 'Checkout session created', type: CheckoutResponseDto })
  @ApiResponse({ status: 403, description: 'New subscription flow is disabled' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  createCheckout(
    @Body() body: CreateCheckoutDto,
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
  @ApiOperation({ summary: 'Get a checkout session by ID', description: 'Returns full checkout details including transaction hash and error if present.' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Checkout session details', type: CheckoutResponseDto })
  @ApiResponse({ status: 400, description: 'Checkout session has expired' })
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
  @ApiOperation({ summary: 'Get plan summary for a checkout session', description: 'Returns creator name, asset, amount, and billing interval for the plan attached to this checkout.' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Plan summary', type: PlanSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Checkout or plan not found' })
  getPlanSummary(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getPlanSummary(checkout.planId);
  }

  @Get('checkout/:id/price')
  @ApiOperation({ summary: 'Get price breakdown for a checkout session', description: 'Returns subtotal, platform fee, network fee, and total for the checkout.' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Price breakdown', type: PriceBreakdownResponseDto })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
  getPriceBreakdown(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getPriceBreakdown(checkoutId);
  }

  @Get('checkout/:id/wallet')
  @ApiOperation({ summary: 'Get wallet status for a checkout session', description: 'Returns the fan wallet balances and connection status for the checkout session.' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Wallet status', type: WalletStatusResponseDto })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
  getWalletStatus(@Param('id') checkoutId: string) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.getWalletStatus(checkout.fanAddress);
  }

  @Get('checkout/:id/preview')
  @ApiOperation({ summary: 'Get transaction preview for a checkout session', description: 'Returns a preview of the Stellar transaction including from/to addresses, asset, amount, fee, and memo.' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Transaction preview', type: TransactionPreviewResponseDto })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
  getTransactionPreview(@Param('id') checkoutId: string) {
    return this.subscriptionsService.getTransactionPreview(checkoutId);
  }

  @Post('checkout/:id/validate')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Validate fan wallet balance for a checkout session' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Balance validation result', type: ValidateBalanceResponseDto })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
  validateBalance(
    @Param('id') checkoutId: string,
    @Body() body: ValidateBalanceDto,
  ) {
    const checkout = this.subscriptionsService.getCheckout(checkoutId);
    return this.subscriptionsService.validateBalance(
      checkout.fanAddress,
      body.assetCode,
      body.amount,
    );
  }

  @Post('checkout/:id/confirm')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Confirm a subscription checkout' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Subscription confirmed', type: ConfirmSubscriptionResponseDto })
  @ApiResponse({ status: 400, description: 'Checkout expired' })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
  confirmSubscription(
    @Param('id') checkoutId: string,
    @Body() body: ConfirmSubscriptionDto,
  ) {
    return this.subscriptionsService.confirmSubscription(checkoutId, body.txHash);
  }

  @Post('checkout/:id/fail')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Mark a checkout session as failed' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiParam({ name: 'id', description: 'Checkout session ID' })
  @ApiResponse({ status: 200, description: 'Checkout marked as failed' })
  @ApiResponse({ status: 404, description: 'Checkout not found' })
  failCheckout(
    @Param('id') checkoutId: string,
    @Body() body: FailCheckoutDto,
  ) {
    return this.subscriptionsService.failCheckout(
      checkoutId,
      body.error,
      body.rejected,
    );
  }

  @Post('cancel')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  cancelSubscription(
    @Body() body: CancelSubscriptionDto,
  ) {
    return this.subscriptionsService.cancelSubscription(
      body.fanAddress,
      body.creatorAddress,
    );
  }
}

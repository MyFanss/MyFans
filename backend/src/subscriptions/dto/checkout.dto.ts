import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Fan Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  fanAddress: string;

  @ApiProperty({ description: 'Creator Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  creatorAddress: string;

  @ApiProperty({ description: 'Subscription plan ID', minimum: 1 })
  @IsInt()
  @Min(1)
  planId: number;

  @ApiPropertyOptional({ description: 'Asset code (default: XLM)', default: 'XLM' })
  @IsOptional()
  @IsString()
  assetCode?: string;

  @ApiPropertyOptional({ description: 'Asset issuer address (for non-native assets)' })
  @IsOptional()
  @IsString()
  assetIssuer?: string;
}

export class CheckoutResponseDto {
  @ApiProperty({ description: 'Checkout session ID' }) id: string;
  @ApiProperty({ description: 'Fan Stellar G-address' }) fanAddress: string;
  @ApiProperty({ description: 'Creator Stellar G-address' }) creatorAddress: string;
  @ApiProperty({ description: 'Subscription plan ID' }) planId: number;
  @ApiProperty({ description: 'Asset code' }) assetCode: string;
  @ApiPropertyOptional({ description: 'Asset issuer address' }) assetIssuer?: string;
  @ApiProperty({ description: 'Subscription amount' }) amount: string;
  @ApiProperty({ description: 'Platform fee' }) fee: string;
  @ApiProperty({ description: 'Total including fees' }) total: string;
  @ApiProperty({ description: 'Checkout status', enum: ['pending', 'completed', 'failed', 'rejected', 'expired'] }) status: string;
  @ApiProperty({ description: 'Session expiry timestamp' }) expiresAt: Date;
  @ApiPropertyOptional({ description: 'Transaction hash (after confirmation)' }) txHash?: string;
  @ApiPropertyOptional({ description: 'Error message (on failure)' }) error?: string;
  @ApiProperty({ description: 'Creation timestamp' }) createdAt: Date;
  @ApiProperty({ description: 'Last update timestamp' }) updatedAt: Date;
}

export class ValidateBalanceDto {
  @ApiProperty({ description: 'Asset code to check balance for' })
  @IsString()
  @IsNotEmpty()
  assetCode: string;

  @ApiProperty({ description: 'Required amount' })
  @IsString()
  @IsNotEmpty()
  amount: string;
}

export class ValidateBalanceResponseDto {
  @ApiProperty({ description: 'Whether balance is sufficient' }) valid: boolean;
  @ApiProperty({ description: 'Current balance' }) balance: string;
  @ApiPropertyOptional({ description: 'Amount short (if insufficient)' }) shortfall?: string;
}

export class ConfirmSubscriptionDto {
  @ApiPropertyOptional({ description: 'Transaction hash from Stellar network' })
  @IsOptional()
  @IsString()
  txHash?: string;
}

export class ConfirmSubscriptionResponseDto {
  @ApiProperty() success: boolean;
  @ApiProperty() checkoutId: string;
  @ApiProperty() status: string;
  @ApiProperty() txHash: string;
  @ApiProperty() explorerUrl: string;
  @ApiProperty() subscriptionId: string;
  @ApiProperty({ enum: ['created', 'renewed'] }) lifecycleEvent: string;
  @ApiProperty() message: string;
}

export class FailCheckoutDto {
  @ApiProperty({ description: 'Error message describing the failure' })
  @IsString()
  @IsNotEmpty()
  error: string;

  @ApiPropertyOptional({ description: 'Whether the transaction was rejected by the user', default: false })
  @IsOptional()
  rejected?: boolean;
}

export class CancelSubscriptionDto {
  @ApiProperty({ description: 'Fan Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  fanAddress: string;

  @ApiProperty({ description: 'Creator Stellar G-address' })
  @IsString()
  @IsNotEmpty()
  creatorAddress: string;
}

export class PlanSummaryResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() creatorName: string;
  @ApiProperty() creatorAddress: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() assetCode: string;
  @ApiPropertyOptional() assetIssuer?: string;
  @ApiProperty() amount: string;
  @ApiProperty() interval: string;
  @ApiProperty() intervalDays: number;
}

export class PriceBreakdownResponseDto {
  @ApiProperty() subtotal: string;
  @ApiProperty() platformFee: string;
  @ApiProperty() networkFee: string;
  @ApiProperty() total: string;
  @ApiProperty() currency: string;
}

export class WalletStatusResponseDto {
  @ApiProperty() address: string;
  @ApiProperty({ isArray: true }) balances: {
    code: string;
    issuer?: string;
    balance: string;
    isNative: boolean;
  }[];
  @ApiProperty() isConnected: boolean;
}

export class TransactionPreviewResponseDto {
  @ApiProperty() checkoutId: string;
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty() asset: { code: string; issuer?: string };
  @ApiProperty() amount: string;
  @ApiProperty() fee: string;
  @ApiProperty() total: string;
  @ApiProperty() memo: string;
}

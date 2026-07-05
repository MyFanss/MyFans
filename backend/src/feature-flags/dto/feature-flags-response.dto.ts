import { ApiProperty } from '@nestjs/swagger';
import type { FeatureFlagsSnapshot } from '../feature-flags.service';

export class FeatureFlagsResponseDto implements FeatureFlagsSnapshot {
  @ApiProperty({
    description: 'Whether bookmark features are enabled.',
    example: false,
  })
  bookmarks!: boolean;

  @ApiProperty({
    description: 'Whether earnings withdrawal features are enabled.',
    example: false,
  })
  earnings_withdrawals!: boolean;

  @ApiProperty({
    description: 'Whether earnings fee transparency features are enabled.',
    example: false,
  })
  earnings_fee_transparency!: boolean;

  @ApiProperty({
    description: 'Whether the new subscription flow is enabled.',
    example: false,
  })
  newSubscriptionFlow!: boolean;

  @ApiProperty({
    description: 'Whether crypto payment flows are enabled.',
    example: false,
  })
  cryptoPayments!: boolean;

  @ApiProperty({
    description: 'Whether referral code features are enabled.',
    example: false,
  })
  referralCodes!: boolean;

  @ApiProperty({
    description: 'Whether the Soroban poller is enabled.',
    example: true,
  })
  sorobanPoller!: boolean;
}

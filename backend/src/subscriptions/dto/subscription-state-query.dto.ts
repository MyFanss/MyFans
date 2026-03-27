import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Query params for fan–creator subscription state.
 */
export class SubscriptionStateQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z0-9]{55}$/, {
    message:
      'creator must be a Stellar account address (G-strkey, 56 characters)',
  })
  creator!: string;
}

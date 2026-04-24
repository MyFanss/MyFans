import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query params for fan–creator subscription state.
 */
export class SubscriptionStateQueryDto {
  @ApiProperty({
    description: 'Creator Stellar G-address (56-char G-strkey)',
    example: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z0-9]{55}$/, {
    message:
      'creator must be a Stellar account address (G-strkey, 56 characters)',
  })
  creator!: string;
}

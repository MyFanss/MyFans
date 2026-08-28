import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RedeemReferralCodeDto {
  @ApiProperty({ description: 'Referral / invite code', example: 'ALICE10' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  @Matches(/^[A-Z0-9]+$/, { message: 'code must be uppercase alphanumeric' })
  code: string;

  @ApiPropertyOptional({
    description:
      'Stellar address of the subscribing fan. Captured at checkout so the ' +
      'first SubscriptionCreatedEvent for this address attributes the claim.',
    example: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
  })
  @IsOptional()
  @IsString()
  @Length(56, 56)
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'subscriberAddress must be a valid Stellar public key',
  })
  subscriberAddress?: string;
}

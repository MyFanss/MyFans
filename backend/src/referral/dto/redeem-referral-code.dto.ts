import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemReferralCodeDto {
  @ApiProperty({ description: 'Referral / invite code', example: 'ALICE10' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  @Matches(/^[A-Z0-9]+$/, { message: 'code must be uppercase alphanumeric' })
  code: string;
}

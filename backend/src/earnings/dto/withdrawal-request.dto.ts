import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class WithdrawalRequestDto {
  @ApiProperty({ description: 'Amount to withdraw, as a decimal string', example: '25.5000000' })
  @IsNotEmpty()
  @IsNumberString()
  amount: string;

  @ApiProperty({ description: 'Asset code to withdraw', example: 'XLM' })
  @IsNotEmpty()
  @IsString()
  asset: string;
}

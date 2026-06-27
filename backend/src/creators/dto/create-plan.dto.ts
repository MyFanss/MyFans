import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, Max } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({
    description: 'Creator address or identifier',
    example: 'GAB6... (Stellar address)',
  })
  @IsNotEmpty()
  @IsString()
  creator: string;

  @ApiProperty({
    description: 'Asset code (e.g. USDC, XLM, ETH)',
    example: 'USDC',
  })
  @IsNotEmpty()
  @IsString()
  asset: string;

  @ApiProperty({
    description: 'Subscription amount as string (decimal)',
    example: '100.50',
  })
  @IsNotEmpty()
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Interval in days between subscription cycles',
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(365)
  intervalDays: number;
}

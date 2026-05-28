import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CapPeriod } from '../entities/fan-spending-cap.entity';

export class SetSpendingCapDto {
  @ApiPropertyOptional({
    description: 'Maximum spend per period in stroops (null removes the cap)',
    nullable: true,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  capAmount?: number | null;

  @ApiProperty({ enum: CapPeriod, default: CapPeriod.MONTHLY })
  @IsEnum(CapPeriod)
  period: CapPeriod = CapPeriod.MONTHLY;
}

export class SpendingCapResponseDto {
  @ApiProperty() fanAddress: string;
  @ApiProperty({ nullable: true }) capAmount: string | null;
  @ApiProperty({ enum: CapPeriod }) period: CapPeriod;
  @ApiProperty() spentAmount: string;
  @ApiProperty({ nullable: true }) periodStartedAt: string | null;
  @ApiProperty() updatedAt: string;
}

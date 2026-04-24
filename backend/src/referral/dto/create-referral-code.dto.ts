import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReferralCodeDto {
  @ApiPropertyOptional({ description: 'Max redemptions (omit for unlimited)', example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  @Type(() => Number)
  maxUses?: number;
}

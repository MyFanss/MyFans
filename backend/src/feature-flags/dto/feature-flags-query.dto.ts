import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional } from 'class-validator';
import { FEATURE_FLAG_NAMES, FeatureFlagName } from '../feature-flags.service';

function normalizeFlagNames(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized: unknown[] = [];
  for (const item of values) {
    if (typeof item !== 'string') {
      normalized.push(item);
      continue;
    }

    normalized.push(
      ...item
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
    );
  }

  return normalized;
}

export class FeatureFlagsQueryDto {
  @ApiPropertyOptional({
    description: 'Comma-separated list of feature flag names to return',
    enum: FEATURE_FLAG_NAMES,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeFlagNames(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(FEATURE_FLAG_NAMES, { each: true })
  names?: FeatureFlagName[];
}

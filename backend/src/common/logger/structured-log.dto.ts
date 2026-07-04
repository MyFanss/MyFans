import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export const STRUCTURED_LOG_LEVELS = [
  'info',
  'warn',
  'error',
  'debug',
] as const;
export type StructuredLogLevel = (typeof STRUCTURED_LOG_LEVELS)[number];
export type StructuredLogData = Record<string, unknown>;

export class StructuredLogDto {
  @ApiProperty({
    enum: STRUCTURED_LOG_LEVELS,
    description: 'Structured log severity.',
  })
  @IsIn(STRUCTURED_LOG_LEVELS)
  level: StructuredLogLevel;

  @ApiProperty({
    example: 'subscription.created',
    description: 'Human-readable log message.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Redactable structured payload attached to the log entry.',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  data?: StructuredLogData;

  @ApiPropertyOptional({
    example: 'SubscriptionsService',
    description: 'NestJS logging context.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  context?: string;
}

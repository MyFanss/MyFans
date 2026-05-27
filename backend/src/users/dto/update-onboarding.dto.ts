import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const STEPS = ['account-type', 'profile', 'social-links', 'verification'] as const;
const INTENTS = ['creator', 'fan', 'both'] as const;

export class UpdateOnboardingDto {
  @ApiPropertyOptional({ enum: STEPS })
  @IsOptional()
  @IsString()
  @IsIn(STEPS as unknown as string[])
  currentStep?: (typeof STEPS)[number];

  @ApiPropertyOptional({ enum: STEPS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(STEPS as unknown as string[], { each: true })
  completedSteps?: Array<(typeof STEPS)[number]>;

  @ApiPropertyOptional({ enum: STEPS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(STEPS as unknown as string[], { each: true })
  skippedSteps?: Array<(typeof STEPS)[number]>;

  @ApiPropertyOptional({ enum: INTENTS, nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(INTENTS as unknown as string[])
  intent?: (typeof INTENTS)[number];

  @ApiPropertyOptional({ description: 'Optional client timestamp', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  updatedAt?: string;
}


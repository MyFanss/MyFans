import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';

/**
 * Query params for the admin on-demand creator-registry reconcile endpoint
 * (`POST /v1/creators/registry/reconcile`, #1625).
 */
export class ReconcileRegistryQueryDto {
  @ApiPropertyOptional({
    description:
      'When "true", reports drift without persisting drift markers (dry run). ' +
      'When omitted, falls back to the CREATOR_REGISTRY_RECONCILER_DRY_RUN env var, ' +
      'mirroring the scheduled cron.',
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  dryRun?: string;
}

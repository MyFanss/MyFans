import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDto {
  @ApiProperty({ enum: ['up', 'down', 'degraded'] })
  status: 'up' | 'down' | 'degraded';

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}

export class SubsystemStatusDto {
  @ApiProperty({ enum: ['up', 'down', 'degraded'] })
  status: 'up' | 'down' | 'degraded';

  @ApiProperty({ required: false, example: 5 })
  latencyMs?: number;

  @ApiProperty({ required: false, example: 'Connection refused' })
  error?: string;
}

export class RedisStatusDto {
  @ApiProperty({ enum: ['up', 'down', 'not_configured'] })
  status: 'up' | 'down' | 'not_configured';

  @ApiProperty({ required: false, example: 5 })
  latencyMs?: number;

  @ApiProperty({ required: false, example: 'Connection refused' })
  error?: string;
}

export class SorobanStatusDto {
  @ApiProperty({ enum: ['up', 'down', 'degraded'] })
  status: 'up' | 'down' | 'degraded';

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ required: false })
  rpcUrl?: string;

  @ApiProperty({ required: false })
  ledger?: number;

  @ApiProperty({ required: false })
  responseTime?: number;

  @ApiProperty({ required: false })
  error?: string;
}

export class DetailedHealthChecksDto {
  @ApiProperty({ type: SubsystemStatusDto })
  database: SubsystemStatusDto;

  @ApiProperty({ type: SorobanStatusDto, required: false })
  sorobanRpc?: SorobanStatusDto;

  @ApiProperty({ type: SorobanStatusDto, required: false })
  sorobanContract?: SorobanStatusDto;
}

export class DetailedHealthStatusDto extends HealthStatusDto {
  @ApiProperty({ type: DetailedHealthChecksDto, required: false })
  checks?: DetailedHealthChecksDto;
}

export class HealthSummaryDto {
  @ApiProperty({ example: 4 })
  total: number;

  @ApiProperty({ example: 3 })
  up: number;

  @ApiProperty({ example: 0 })
  degraded: number;

  @ApiProperty({ example: 1 })
  down: number;
}

export class AggregatedSubsystemsDto {
  @ApiProperty({ type: SubsystemStatusDto })
  database: SubsystemStatusDto;

  @ApiProperty({
    type: RedisStatusDto,
    required: false,
    description: 'Omitted when Redis is not configured.',
  })
  redis?: RedisStatusDto;

  @ApiProperty({ type: SorobanStatusDto })
  sorobanRpc: SorobanStatusDto;

  @ApiProperty({ type: SorobanStatusDto })
  sorobanContract: SorobanStatusDto;
}

export class AggregatedHealthDto extends HealthStatusDto {
  @ApiProperty({ example: 3600 })
  uptime: number;

  @ApiProperty({ example: '1.0.0' })
  version: string;

  @ApiProperty({ type: AggregatedSubsystemsDto })
  subsystems: AggregatedSubsystemsDto;

  @ApiProperty({ type: HealthSummaryDto })
  summary: HealthSummaryDto;
}

export class QueueSnapshotDto {
  @ApiProperty({ type: Object, additionalProperties: { type: 'number' } })
  [key: string]: unknown;
}

export class QueueMetricsDto {
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ type: QueueSnapshotDto })
  queues: QueueSnapshotDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanDto {
  @ApiProperty({ example: 1, description: 'Unique plan identifier' })
  id: number;

  @ApiProperty({ example: 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7', description: 'Creator Stellar address' })
  creator: string;

  @ApiProperty({ example: 'native', description: 'Asset code (e.g., native for XLM)' })
  asset: string;

  @ApiProperty({ example: '100.00', description: 'Subscription amount' })
  amount: string;

  @ApiProperty({ example: 30, description: 'Billing interval in days' })
  intervalDays: number;

  @ApiPropertyOptional({
    example: 'synced',
    description: 'On-chain sync status (synced, stale, missing, unknown)',
    enum: ['synced', 'stale', 'missing', 'unknown'],
  })
  syncStatus?: 'synced' | 'stale' | 'missing' | 'unknown';

  @ApiPropertyOptional({ description: 'Last time plan was synced with on-chain state' })
  lastSyncedAt?: Date;
}

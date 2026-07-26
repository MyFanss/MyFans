import { ApiProperty } from '@nestjs/swagger';

export class WithdrawalResponseDto {
  @ApiProperty({ description: 'Withdrawal request identifier' })
  id: string;

  @ApiProperty({ description: 'Creator Stellar address the withdrawal was requested for' })
  creator: string;

  @ApiProperty({ example: '25.5000000' })
  amount: string;

  @ApiProperty({ example: 'XLM' })
  asset: string;

  @ApiProperty({
    description: 'Withdrawal status. Automated payout processing is not yet implemented.',
    example: 'pending_manual_review',
  })
  status: 'pending_manual_review';

  @ApiProperty({ description: 'ISO 8601 timestamp the request was recorded' })
  requestedAt: string;

  @ApiProperty({
    description: 'Human-readable note about the current (stub) processing state',
  })
  note: string;
}

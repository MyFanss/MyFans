export class EarningsSummaryDto {
  total_earnings: string;
  total_earnings_usd: number;
  pending_amount: string;
  available_for_withdrawal: string;
  currency: string;
  period_start: string;
  period_end: string;
}

export class EarningsBreakdownDto {
  by_time: Array<{
    date: string;
    amount: string;
    currency: string;
    count: number;
  }>;
  by_plan: Array<{
    plan_id: string;
    plan_name: string;
    total_amount: string;
    currency: string;
    subscriber_count: number;
  }>;
  by_asset: Array<{
    asset: string;
    total_amount: string;
    percentage: number;
  }>;
}

export class TransactionHistoryDto {
  id: string;
  date: string;
  type: 'subscription' | 'post_purchase' | 'tip' | 'withdrawal' | 'fee';
  description: string;
  amount: string;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  reference_id?: string;
  tx_hash?: string;
}

export class WithdrawalRequestDto {
  amount: string;
  currency: string;
  destination_address: string;
  method: 'wallet' | 'bank';
}

export class WithdrawalDto {
  id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  destination_address: string;
  tx_hash?: string;
  fee: string;
  net_amount: string;
}

export class FeeTransparencyDto {
  protocol_fee_bps: number;
  protocol_fee_percentage: number;
  withdrawal_fee_fixed: string;
  withdrawal_fee_percentage: number;
  example_earnings: string;
  example_protocol_fee: string;
  example_net_earnings: string;
  example_withdrawal_fee: string;
  example_final_amount: string;
}

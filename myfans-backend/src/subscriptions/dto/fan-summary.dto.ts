export class FanSubscriptionItemDto {
  subscription_id!: string;
  creator_id!: string;
  creator_username!: string | null;
  creator_display_name!: string | null;
  plan_id!: string | null;
  started_at!: Date;
  expires_at!: Date;
  renew_date!: Date;
}

export class FanSummaryDto {
  total_active!: number;
  items!: FanSubscriptionItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  total_pages!: number;
}

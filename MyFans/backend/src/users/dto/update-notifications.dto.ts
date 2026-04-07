import { IsBoolean, IsOptional } from 'class-validator';

// ── Channel preferences ────────────────────────────────────────────────────

export class UpdateNotificationsDto {
  // Channels
  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  push_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing_emails?: boolean;

  // Per-event toggles — email channel
  @IsOptional()
  @IsBoolean()
  email_new_subscriber?: boolean;

  @IsOptional()
  @IsBoolean()
  email_subscription_renewal?: boolean;

  @IsOptional()
  @IsBoolean()
  email_new_comment?: boolean;

  @IsOptional()
  @IsBoolean()
  email_new_like?: boolean;

  @IsOptional()
  @IsBoolean()
  email_new_message?: boolean;

  @IsOptional()
  @IsBoolean()
  email_payout?: boolean;

  // Per-event toggles — push channel
  @IsOptional()
  @IsBoolean()
  push_new_subscriber?: boolean;

  @IsOptional()
  @IsBoolean()
  push_subscription_renewal?: boolean;

  @IsOptional()
  @IsBoolean()
  push_new_comment?: boolean;

  @IsOptional()
  @IsBoolean()
  push_new_like?: boolean;

  @IsOptional()
  @IsBoolean()
  push_new_message?: boolean;

  @IsOptional()
  @IsBoolean()
  push_payout?: boolean;
}

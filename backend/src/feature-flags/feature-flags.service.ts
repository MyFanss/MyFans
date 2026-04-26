import { Injectable } from '@nestjs/common';

const FEATURE_FLAG_ENV_KEYS = {
  bookmarks: ['FEATURE_FLAG_BOOKMARKS', 'NEXT_PUBLIC_FLAG_BOOKMARKS'],
  earnings_withdrawals: [
    'FEATURE_FLAG_EARNINGS_WITHDRAWALS',
    'NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS',
  ],
  earnings_fee_transparency: [
    'FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY',
    'NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY',
  ],
  newSubscriptionFlow: [
    'FEATURE_NEW_SUBSCRIPTION_FLOW',
    'FEATURE_FLAG_NEW_SUBSCRIPTION_FLOW',
  ],
  cryptoPayments: ['FEATURE_CRYPTO_PAYMENTS', 'FEATURE_FLAG_CRYPTO_PAYMENTS'],
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAG_ENV_KEYS;
export type FrontendFeatureFlagName =
  | 'bookmarks'
  | 'earnings_withdrawals'
  | 'earnings_fee_transparency';
export type FeatureFlagsSnapshot = Record<FrontendFeatureFlagName, boolean>;

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}

@Injectable()
export class FeatureFlagsService {
  isEnabled(flag: FeatureFlagName): boolean {
    for (const envKey of FEATURE_FLAG_ENV_KEYS[flag]) {
      const parsed = parseBooleanEnv(process.env[envKey]);
      if (parsed !== undefined) {
        return parsed;
      }
    }

    return false;
  }

  isNewSubscriptionFlowEnabled(): boolean {
    return this.isEnabled('newSubscriptionFlow');
  }

  isCryptoPaymentsEnabled(): boolean {
    return this.isEnabled('cryptoPayments');
  }

  getAllFlags(): { flags: FeatureFlagsSnapshot } {
    return {
      flags: {
        bookmarks: this.isEnabled('bookmarks'),
        earnings_withdrawals: this.isEnabled('earnings_withdrawals'),
        earnings_fee_transparency: this.isEnabled('earnings_fee_transparency'),
      },
  isReferralCodesEnabled(): boolean {
    return process.env.FEATURE_REFERRAL_CODES === 'true';
  }

  isSorobanPollerEnabled(): boolean {
    return process.env.FEATURE_SOROBAN_POLLER !== 'false';
  }

  getAllFlags() {
    return {
      newSubscriptionFlow: this.isNewSubscriptionFlowEnabled(),
      cryptoPayments: this.isCryptoPaymentsEnabled(),
      referralCodes: this.isReferralCodesEnabled(),
      sorobanPoller: this.isSorobanPollerEnabled(),
    };
  }
}

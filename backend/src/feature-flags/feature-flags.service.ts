import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  referralCodes: ['FEATURE_REFERRAL_CODES'],
  sorobanPoller: ['FEATURE_SOROBAN_POLLER'],
  // Gates shortening the access JWT TTL from 24h to 15m (#1565) — off by
  // default since other code may still assume a 24h-lived access token.
  shortLivedAccessTokens: ['FEATURE_SHORT_LIVED_ACCESS_TOKENS'],
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAG_ENV_KEYS;
export type FeatureFlagsSnapshot = Record<FeatureFlagName, boolean>;

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
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(private readonly configService: ConfigService) {}

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

  isReferralCodesEnabled(): boolean {
    return this.isEnabled('referralCodes');
  }

  isSorobanPollerEnabled(): boolean {
    const explicit = parseBooleanEnv(process.env.FEATURE_SOROBAN_POLLER);
    if (explicit !== undefined) {
      return explicit;
    }

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    if (!isProduction) {
      return false;
    }

    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')?.trim();
    const contractId =
      this.configService.get<string>('CONTRACT_ID_SUBSCRIPTION')?.trim() ||
      this.configService.get<string>('SUBSCRIPTION_CONTRACT_ID')?.trim() ||
      this.configService.get<string>('CONTRACT_ID_MYFANS')?.trim();

    return !!(rpcUrl && contractId);
  }

  logPollerFlagResolution(): void {
    const isEnabled = this.isSorobanPollerEnabled();
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const explicit = parseBooleanEnv(process.env.FEATURE_SOROBAN_POLLER);
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')?.trim();
    const contractId =
      this.configService.get<string>('CONTRACT_ID_SUBSCRIPTION')?.trim() ||
      this.configService.get<string>('SUBSCRIPTION_CONTRACT_ID')?.trim() ||
      this.configService.get<string>('CONTRACT_ID_MYFANS')?.trim();

    if (explicit !== undefined) {
      this.logger.log(
        `Soroban poller: explicitly ${isEnabled ? 'enabled' : 'disabled'} via FEATURE_SOROBAN_POLLER`,
      );
    } else if (isProduction) {
      const reason = rpcUrl && contractId ? 'production + configured' : 'production but missing configuration';
      this.logger.log(
        `Soroban poller: ${isEnabled ? 'enabled' : 'disabled'} (${reason}; RPC=${!!rpcUrl}, contract=${!!contractId})`,
      );
    } else {
      this.logger.log('Soroban poller: disabled (test environment)');
    }
  }

  getAllFlags(): FeatureFlagsSnapshot {
    return {
      bookmarks: this.isEnabled('bookmarks'),
      earnings_withdrawals: this.isEnabled('earnings_withdrawals'),
      earnings_fee_transparency: this.isEnabled('earnings_fee_transparency'),
      newSubscriptionFlow: this.isNewSubscriptionFlowEnabled(),
      cryptoPayments: this.isCryptoPaymentsEnabled(),
      referralCodes: this.isReferralCodesEnabled(),
      sorobanPoller: this.isSorobanPollerEnabled(),
    };
  }
}

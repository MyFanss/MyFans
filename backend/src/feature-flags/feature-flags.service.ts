import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagsService {
  isNewSubscriptionFlowEnabled(): boolean {
    return process.env.FEATURE_NEW_SUBSCRIPTION_FLOW === 'true';
  }

  isCryptoPaymentsEnabled(): boolean {
    return process.env.FEATURE_CRYPTO_PAYMENTS === 'true';
  }

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

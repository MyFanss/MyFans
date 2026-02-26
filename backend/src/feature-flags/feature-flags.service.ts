import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagsService {
  isNewSubscriptionFlowEnabled(): boolean {
    return process.env.FEATURE_NEW_SUBSCRIPTION_FLOW === 'true';
  }

  isCryptoPaymentsEnabled(): boolean {
    return process.env.FEATURE_CRYPTO_PAYMENTS === 'true';
  }

  getAllFlags() {
    return {
      newSubscriptionFlow: this.isNewSubscriptionFlowEnabled(),
      cryptoPayments: this.isCryptoPaymentsEnabled(),
    };
  }
}

export const featureFlags = {
  newSubscriptionFlow:
    process.env.NEXT_PUBLIC_FEATURE_NEW_SUBSCRIPTION_FLOW === 'true',
  cryptoPayments: process.env.NEXT_PUBLIC_FEATURE_CRYPTO_PAYMENTS === 'true',
};

export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature];
}

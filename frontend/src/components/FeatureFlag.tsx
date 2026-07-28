'use client';

import { ReactNode } from 'react';
import {
  FeatureFlag as FeatureFlagKey,
  isFeatureEnabled,
} from '@/lib/feature-flags';

interface FeatureFlagProps {
  feature: typeof FeatureFlagKey.NEW_SUBSCRIPTION_FLOW | typeof FeatureFlagKey.CRYPTO_PAYMENTS;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Lightweight gate that reads the unified feature-flag module.
 * Prefer `FeatureGate` + `useFeatureFlag` for new UI that needs the provider.
 */
export function FeatureFlag({ feature, children, fallback = null }: FeatureFlagProps) {
  if (!isFeatureEnabled(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

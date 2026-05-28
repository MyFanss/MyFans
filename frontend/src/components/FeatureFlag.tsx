'use client';

import { ReactNode } from 'react';
import { isFeatureEnabled } from '@/lib/featureFlags';

interface FeatureFlagProps {
  feature: 'newSubscriptionFlow' | 'cryptoPayments';
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlag({ feature, children, fallback = null }: FeatureFlagProps) {
  if (!isFeatureEnabled(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

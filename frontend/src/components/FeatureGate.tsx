'use client';

import { type ReactNode } from 'react';
import { type FeatureFlag } from '@/lib/feature-flags';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface FeatureGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  flag: FeatureFlag;
}

export function FeatureGate({ children, fallback = null, flag }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);

  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

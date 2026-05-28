'use client';

import { FeatureFlag } from '@/lib/feature-flags';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { flags, isReady } = useFeatureFlagsContext();

  if (!isReady) {
    return false;
  }

  return flags[flag] ?? false;
}

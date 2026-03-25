'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  FEATURE_FLAGS_UPDATED_EVENT,
  defaultFeatureFlags,
  getFeatureFlags,
  loadFeatureFlags,
  type FeatureFlagSnapshot,
} from '@/lib/feature-flags';

interface FeatureFlagsContextValue {
  flags: FeatureFlagSnapshot;
  isReady: boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

function shouldRefreshFromStorage(key: string | null): boolean {
  return key?.startsWith('flags:') ?? false;
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlagSnapshot>(defaultFeatureFlags);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    const initializeFlags = async () => {
      const nextFlags = await loadFeatureFlags();

      if (!isActive) {
        return;
      }

      setFlags(nextFlags);
      setIsReady(true);
    };

    void initializeFlags();

    const handleStorage = (event: StorageEvent) => {
      if (!shouldRefreshFromStorage(event.key)) {
        return;
      }

      setFlags(getFeatureFlags());
    };

    const handleFeatureFlagsUpdated = () => {
      setFlags(getFeatureFlags());
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(FEATURE_FLAGS_UPDATED_EVENT, handleFeatureFlagsUpdated);

    return () => {
      isActive = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(FEATURE_FLAGS_UPDATED_EVENT, handleFeatureFlagsUpdated);
    };
  }, []);

  const value = useMemo(
    () => ({
      flags,
      isReady,
    }),
    [flags, isReady],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlagsContext(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext);

  if (!context) {
    throw new Error('useFeatureFlagsContext must be used within a FeatureFlagsProvider');
  }

  return context;
}

'use client';

import React from 'react';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useRpcStatusContext } from '@/contexts/RpcStatusContext';

/**
 * Thin client component that reads RPC status from context and renders
 * the OfflineBanner. Kept separate so layout.tsx (server component) can
 * import it without breaking the server/client boundary.
 */
export function RpcOfflineBannerWrapper() {
  const { status, retry } = useRpcStatusContext();
  return <OfflineBanner status={status} onRetry={retry} />;
}

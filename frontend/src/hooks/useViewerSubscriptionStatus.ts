'use client';

import { useEffect, useState } from 'react';
import type { SubscriptionStatus } from '@/lib/subscription-status';
import { getSubscriptionStatusForCreator } from '@/lib/client-session';
import { useWallet } from '@/hooks/useWallet';

export interface UseViewerSubscriptionStatusResult {
  status: SubscriptionStatus | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook to fetch the live subscription status of the current viewer for a creator.
 * - Degrades to `null` (not-subscribed / visitor view) when logged out or no wallet present.
 * - Fetches live API status when wallet/session is present.
 */
export function useViewerSubscriptionStatus(
  creatorUsernameOrId?: string | null,
): UseViewerSubscriptionStatusResult {
  const { isConnected, address } = useWallet();
  const [status, setStatus] = useState<SubscriptionStatus | null>(() => {
    if (!creatorUsernameOrId) return null;
    return getSubscriptionStatusForCreator(creatorUsernameOrId);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!creatorUsernameOrId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    // Logged out / no wallet -> degrade to neutral visitor state (null)
    if (!isConnected && !address) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    const fetchStatus = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ creator: creatorUsernameOrId });
        const res = await fetch(`/api/v1/subscriptions/me/subscription-state?${params.toString()}`);
        if (!res.ok) {
          // Fall back to checking list endpoint
          const listRes = await fetch('/api/v1/subscriptions/me/list');
          if (listRes.ok) {
            const listData = await listRes.json();
            const items: Record<string, unknown>[] = Array.isArray(listData)
              ? listData
              : (listData.data ?? []);
            const match = items.find(
              (s) =>
                s.creatorId === creatorUsernameOrId ||
                s.creatorUsername === creatorUsernameOrId ||
                s.creator === creatorUsernameOrId,
            );
            if (mounted) {
              setStatus((match?.status as SubscriptionStatus) ?? null);
            }
            return;
          }
          throw new Error('Failed to fetch subscription state');
        }
        const data = await res.json();
        if (mounted) {
          if (data.active) {
            setStatus('active');
          } else if (data.indexedStatus === 'expired' || data.indexed?.status === 'expired') {
            setStatus('expired');
          } else if (data.indexed?.status === 'cancelled') {
            setStatus('cancelled');
          } else {
            setStatus(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          const cached = getSubscriptionStatusForCreator(creatorUsernameOrId);
          setStatus(cached);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchStatus();

    return () => {
      mounted = false;
    };
  }, [creatorUsernameOrId, isConnected, address]);

  return { status, isLoading, error };
}

export default useViewerSubscriptionStatus;

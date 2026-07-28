'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboardData, type DashboardData } from '@/lib/dashboard';

export type DashboardLoadState = 'loading' | 'success' | 'error' | 'empty';

export interface UseDashboardDataOptions {
  fetchFn?: () => Promise<DashboardData>;
}

export interface UseDashboardDataResult {
  state: DashboardLoadState;
  data: DashboardData | null;
  errorMessage: string;
  reload: () => Promise<void>;
}

function isEmpty(data: DashboardData): boolean {
  const { metrics, recentActivity } = data;
  return (
    metrics.totalSubscribers === 0 &&
    metrics.mrr === 0 &&
    metrics.activeSubscriptions === 0 &&
    recentActivity.length === 0
  );
}

/**
 * Loads creator dashboard overview metrics and recent activity.
 */
export function useDashboardData(
  options: UseDashboardDataOptions = {},
): UseDashboardDataResult {
  const fetchFn = options.fetchFn ?? fetchDashboardData;
  const [state, setState] = useState<DashboardLoadState>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const reload = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await fetchFn();
      setData(result);
      setState(isEmpty(result) ? 'empty' : 'success');
    } catch (e) {
      setData(null);
      setState('error');
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [fetchFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, data, errorMessage, reload };
}

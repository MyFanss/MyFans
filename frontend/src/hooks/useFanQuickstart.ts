'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type FanQuickstartState,
  type FanQuickstartStep,
  loadFanQuickstartState,
  saveFanQuickstartState,
  isFanQuickstartComplete,
  FAN_QUICKSTART_STORAGE_KEY,
  FAN_QUICKSTART_UPDATED_EVENT,
} from '@/lib/fan-quickstart';

export const FAN_QUICKSTART_SUBSCRIBE_URL = '/subscribe?fanQuickstart=1';

export function useFanQuickstart() {
  const [state, setState] = useState<FanQuickstartState>(() =>
    loadFanQuickstartState(),
  );

  useEffect(() => {
    saveFanQuickstartState(state);
  }, [state]);

  useEffect(() => {
    const sync = () => {
      const next = loadFanQuickstartState();
      setState((prev) => {
        if (
          prev.wallet === next.wallet &&
          prev.explore === next.explore &&
          prev.subscribe === next.subscribe
        ) {
          return prev;
        }
        return next;
      });
    };
    window.addEventListener(FAN_QUICKSTART_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAN_QUICKSTART_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const markStep = useCallback((step: FanQuickstartStep, done = true) => {
    setState((prev) => ({ ...prev, [step]: done }));
  }, []);

  const reset = useCallback(() => {
    const empty: FanQuickstartState = {
      wallet: false,
      explore: false,
      subscribe: false,
    };
    setState(empty);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FAN_QUICKSTART_STORAGE_KEY);
    }
  }, []);

  const isComplete = useMemo(() => isFanQuickstartComplete(state), [state]);

  const firstIncomplete: FanQuickstartStep | null = useMemo(() => {
    if (!state.wallet) return 'wallet';
    if (!state.explore) return 'explore';
    if (!state.subscribe) return 'subscribe';
    return null;
  }, [state]);

  return {
    state,
    markStep,
    reset,
    isComplete,
    firstIncomplete,
  };
}

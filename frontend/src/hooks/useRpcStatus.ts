'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getStellarRuntimeConfig } from '@/lib/contract-config';

export type RpcStatus = 'online' | 'offline' | 'rpc_down' | 'checking';

export interface RpcStatusResult {
  status: RpcStatus;
  /** True when the browser reports no network connection */
  isBrowserOffline: boolean;
  /** True when the Soroban/Horizon RPC endpoint is unreachable */
  isRpcDown: boolean;
  /** True when either the browser is offline or the RPC is down */
  isOffline: boolean;
  /** Manually trigger a re-check */
  retry: () => void;
}

const RPC_PROBE_INTERVAL_MS = 30_000;
const RPC_PROBE_TIMEOUT_MS = 8_000;

/**
 * Probe the Soroban RPC endpoint with a lightweight health-style request.
 * We call `getHealth` on the JSON-RPC server which is a standard Soroban RPC method.
 */
async function probeRpc(rpcUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      signal: controller.signal,
    });
    // Any HTTP response (even 4xx) means the server is reachable
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * useRpcStatus – tracks browser online state and Soroban RPC reachability.
 *
 * @example
 * ```tsx
 * const { isOffline, status } = useRpcStatus();
 * if (isOffline) return <OfflineBanner status={status} />;
 * ```
 */
export function useRpcStatus(): RpcStatusResult {
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return !navigator.onLine;
  });
  const [isRpcDown, setIsRpcDown] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkRpc = useCallback(async () => {
    // Skip RPC probe when browser is already offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    setIsChecking(true);
    try {
      const config = getStellarRuntimeConfig();
      const reachable = await probeRpc(config.sorobanRpcUrl);
      setIsRpcDown(!reachable);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const retry = useCallback(() => {
    checkRpc();
  }, [checkRpc]);

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOffline(false);
      // Re-probe RPC now that we're back online
      checkRpc();
    };
    const handleOffline = () => {
      setIsBrowserOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial probe
    checkRpc();

    // Periodic probe
    intervalRef.current = setInterval(checkRpc, RPC_PROBE_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkRpc]);

  const isOffline = isBrowserOffline || isRpcDown;

  let status: RpcStatus;
  if (isChecking && !isOffline) {
    status = 'checking';
  } else if (isBrowserOffline) {
    status = 'offline';
  } else if (isRpcDown) {
    status = 'rpc_down';
  } else {
    status = 'online';
  }

  return { status, isBrowserOffline, isRpcDown, isOffline, retry };
}

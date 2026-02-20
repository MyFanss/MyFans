'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type NetworkType = 'PUBLIC' | 'TESTNET' | 'FUTURENET' | 'STANDALONE' | null;

interface WalletState {
  address: string | null;
  network: NetworkType;
  isConnected: boolean;
  extensionInstalled: boolean;
  error: string | null;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
}

const initialState: WalletState = {
  address: null,
  network: null,
  isConnected: false,
  extensionInstalled: false,
  error: null,
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>(initialState);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const freighter = await import('@stellar/freighter-api');
      const connResult = await freighter.isConnected();
      if (!connResult.isConnected) {
        setState({
          address: null,
          network: null,
          isConnected: false,
          extensionInstalled: false,
          error: null,
        });
        return;
      }
      const addrResult = await freighter.getAddress();
      const netResult = await freighter.getNetwork();
      const allowedResult = await freighter.isAllowed();
      const allowed = allowedResult.isAllowed;
      const address = typeof addrResult.address === 'string' ? addrResult.address : null;
      const network = allowed && netResult.network ? (netResult.network as NetworkType) : null;
      setState({
        address: allowed && address ? address : null,
        network,
        isConnected: !!(allowed && address),
        extensionInstalled: true,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        extensionInstalled: false,
        error: err instanceof Error ? err.message : 'Failed to check wallet',
      }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setState((s) => ({ ...s, error: null }));
    try {
      const freighter = await import('@stellar/freighter-api');
      const connRes = await freighter.isConnected();
      if (!connRes.isConnected) {
        setState((s) => ({
          ...s,
          extensionInstalled: false,
          error: 'Freighter extension not installed',
        }));
        return;
      }
      await freighter.requestAccess();
      await refresh();
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to connect wallet',
      }));
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const freighter = await import('@stellar/freighter-api');
      if (typeof freighter.setAllowed === 'function') {
        await freighter.setAllowed();
      }
    } catch {
      // Ignore setAllowed errors
    }
    setState((s) => ({
      ...s,
      address: null,
      network: null,
      isConnected: false,
      error: null,
    }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let watcher: { watch: (cb: (p: { address?: string; network?: string; error?: { message?: string } }) => void) => void; stop: () => void } | undefined;
    const setup = async () => {
      try {
        const freighter = await import('@stellar/freighter-api');
        if (freighter.WatchWalletChanges) {
          watcher = new freighter.WatchWalletChanges(2000);
          watcher.watch((params) => {
            if (params.error || !params.address) {
              setState((s) => ({
                ...s,
                address: null,
                network: null,
                isConnected: false,
                error: params.error?.message ?? null,
              }));
            } else {
              setState((s) => ({
                ...s,
                address: params.address || null,
                network: (params.network as NetworkType) ?? null,
                isConnected: !!params.address,
                error: null,
              }));
            }
          });
        }
      } catch {
        // Extension not available
      }
    };
    setup();
    return () => watcher?.stop();
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      connect,
      disconnect,
      refresh,
    }),
    [state, connect, disconnect, refresh]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

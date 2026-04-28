'use client';

import { useState, useEffect } from 'react';
import { getRuntimeContractConfig } from '@/lib/contract-config';

/** Freighter's getNetwork() response shape */
interface FreighterNetwork {
  network: string;
  networkPassphrase: string;
}

interface WindowWithFreighter extends Window {
  freighter?: {
    getNetwork?: () => Promise<FreighterNetwork>;
  };
}

/** Maps our config network names to Freighter's reported network strings */
const NETWORK_NAME_MAP: Record<string, string> = {
  testnet: 'TESTNET',
  futurenet: 'FUTURENET',
  mainnet: 'PUBLIC',
};

export interface NetworkGuardState {
  /** true while the check is in progress */
  checking: boolean;
  /** true when the wallet is on the wrong network */
  mismatch: boolean;
  /** the network the app expects (e.g. "testnet") */
  expected: string;
  /** the network the wallet reported (null if unknown/not connected) */
  detected: string | null;
}

/**
 * Detects whether the connected Freighter wallet is on the same Stellar
 * network as the app's runtime config. Re-checks on the
 * `freighter:networkChanged` event.
 */
export function useNetworkGuard(): NetworkGuardState {
  const expected = getRuntimeContractConfig().network;

  const [state, setState] = useState<NetworkGuardState>({
    checking: true,
    mismatch: false,
    expected,
    detected: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setState((s) => ({ ...s, checking: true }));

      const freighter = (window as WindowWithFreighter).freighter;
      if (!freighter?.getNetwork) {
        // Wallet not present — no mismatch to report
        if (!cancelled) {
          setState({ checking: false, mismatch: false, expected, detected: null });
        }
        return;
      }

      try {
        const { network } = await freighter.getNetwork();
        const normalised = network?.toUpperCase();
        const expectedUpper = (NETWORK_NAME_MAP[expected] ?? expected).toUpperCase();
        if (!cancelled) {
          setState({
            checking: false,
            mismatch: normalised !== expectedUpper,
            expected,
            detected: network ?? null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ checking: false, mismatch: false, expected, detected: null });
        }
      }
    }

    void check();

    window.addEventListener('freighter:networkChanged', check);
    return () => {
      cancelled = true;
      window.removeEventListener('freighter:networkChanged', check);
    };
  }, [expected]);

  return state;
}

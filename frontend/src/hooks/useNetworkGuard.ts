'use client';

import { useState, useEffect } from 'react';
import { getRuntimeContractConfig } from '@/lib/contract-config';

/** Freighter's getNetwork() response shape */
interface FreighterNetwork {
  network: string;
  networkPassphrase: string;
}

/** Lobstr's getNetwork() response shape */
interface LobstrNetwork {
  network: string;
  networkPassphrase: string;
}

interface WindowWithWallets extends Window {
  freighter?: {
    getNetwork?: () => Promise<FreighterNetwork>;
  };
  lobstr?: {
    getNetwork?: () => Promise<LobstrNetwork>;
  };
}

/** Maps our config network names to wallet reported network strings */
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
 * Detects whether the connected Stellar wallet (Freighter or Lobstr) is on
 * the same network as the app's runtime config. Re-checks on the
 * `freighter:networkChanged` and `lobstr:networkChanged` events.
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

      const windowWithWallets = window as WindowWithWallets;
      const freighter = windowWithWallets.freighter;
      const lobstr = windowWithWallets.lobstr;

      const hasFreighter = !!freighter?.getNetwork;
      const hasLobstr = !!lobstr?.getNetwork;

      if (!hasFreighter && !hasLobstr) {
        // No wallet present — no mismatch to report
        if (!cancelled) {
          setState({ checking: false, mismatch: false, expected, detected: null });
        }
        return;
      }

      try {
        let network: string | null = null;

        if (hasFreighter) {
          const result = await freighter!.getNetwork!();
          network = result.network;
        } else if (hasLobstr) {
          const result = await lobstr!.getNetwork!();
          network = result.network;
        }

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

    const handleNetworkChange = () => void check();
    window.addEventListener('freighter:networkChanged', handleNetworkChange);
    window.addEventListener('lobstr:networkChanged', handleNetworkChange);

    return () => {
      cancelled = true;
      window.removeEventListener('freighter:networkChanged', handleNetworkChange);
      window.removeEventListener('lobstr:networkChanged', handleNetworkChange);
    };
  }, [expected]);

  return state;
}

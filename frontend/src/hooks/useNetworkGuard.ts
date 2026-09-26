import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Network guard (see frontend/docs/NETWORK_GUARD.md).
 *
 * Compares the expected network (configured for the app) against the actual
 * network reported by the wallet/RPC. Fails closed: when the actual network is
 * unknown or unreachable, mutating calls are blocked.
 */

export type NetworkId = 'mainnet' | 'testnet' | 'futurenet' | 'unknown';

export interface NetworkGuardState {
  /** Network the app expects to operate on. */
  expected: NetworkId;
  /** Network actually reported by the wallet/RPC, or 'unknown'. */
  actual: NetworkId;
  /** True when expected and actual differ, or actual is unknown. */
  mismatch: boolean;
  /** True when the actual network could not be determined (RPC unreachable). */
  unreachable: boolean;
  /** True when mutating calls must be blocked. */
  blocked: boolean;
  /** Human-readable reason for the current guard state. */
  reason: string | null;
}

export interface UseNetworkGuardOptions {
  /** Network the app expects. Defaults to 'testnet'. */
  expected?: NetworkId;
  /**
   * Resolves the actual network from the wallet/RPC. May throw or resolve to
   * 'unknown' when the network cannot be determined.
   */
  resolveActual?: () => Promise<NetworkId>;
  /** Poll interval in ms for live wallet network switches. Defaults to 5000. */
  pollIntervalMs?: number;
}

const KNOWN_NETWORKS: readonly NetworkId[] = ['mainnet', 'testnet', 'futurenet'];

function normalizeNetwork(value: unknown): NetworkId {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase();
  return (KNOWN_NETWORKS as readonly string[]).includes(normalized)
    ? (normalized as NetworkId)
    : 'unknown';
}

/**
 * Hook that tracks expected vs actual network and fails closed on mismatch or
 * unknown/unreachable network. Consumers should call `assertCanMutate()` before
 * any mutating call (transaction builders, signatures, submissions).
 */
export function useNetworkGuard(options: UseNetworkGuardOptions = {}): NetworkGuardState & {
  assertCanMutate: () => void;
  refresh: () => Promise<void>;
} {
  const { expected = 'testnet', resolveActual, pollIntervalMs = 5000 } = options;

  const [actual, setActual] = useState<NetworkId>('unknown');
  const [unreachable, setUnreachable] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    if (!resolveActual) {
      // No resolver configured: fail closed rather than assume a network.
      setActual('unknown');
      setUnreachable(true);
      return;
    }
    try {
      const resolved = normalizeNetwork(await resolveActual());
      setActual(resolved);
      setUnreachable(resolved === 'unknown');
    } catch {
      // RPC unreachable or wallet error: fail closed.
      setActual('unknown');
      setUnreachable(true);
    }
  }, [resolveActual]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await refresh();
    };
    void run();
    if (!pollIntervalMs || pollIntervalMs <= 0) {
      return () => {
        cancelled = true;
      };
    }
    const timer = setInterval(() => {
      void run();
    }, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refresh, pollIntervalMs]);

  const state = useMemo<NetworkGuardState>(() => {
    const mismatch = actual === 'unknown' || actual !== expected;
    const blocked = mismatch;
    let reason: string | null = null;
    if (unreachable) {
      reason = 'Network unreachable — mutating calls are blocked.';
    } else if (actual === 'unknown') {
      reason = 'Unknown network — mutating calls are blocked.';
    } else if (mismatch) {
      reason = `Network mismatch: expected ${expected}, connected to ${actual}.`;
    }
    return { expected, actual, mismatch, unreachable, blocked, reason };
  }, [expected, actual, unreachable]);

  const assertCanMutate = useCallback(() => {
    if (state.blocked) {
      throw new Error(
        state.reason ?? 'Network guard blocked a mutating call.',
      );
    }
  }, [state.blocked, state.reason]);

  return { ...state, assertCanMutate, refresh };
}

export default useNetworkGuard;

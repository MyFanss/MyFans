/**
 * Network guard adapter used by usePlan.
 *
 * Wraps the canonical stellar networkGuard so call-sites only need a single
 * import. NETWORK_GUARD takes the plan's raw network string and returns a
 * NetworkGuardResult. When tracing is opt-in the no-op path is preserved.
 */

export type { NetworkGuardResult } from './stellar/networkGuard';
import { checkNetworkGuard } from './stellar/networkGuard';

/**
 * Guard a plan network string against the app's configured network.
 *
 * The configured network is read from NEXT_PUBLIC_STELLAR_NETWORK (defaults to
 * TESTNET). Returns a NetworkGuardResult so callers can surface reason strings.
 */
export function NETWORK_GUARD(
  planNetwork: string | null | undefined,
): import('./stellar/networkGuard').NetworkGuardResult {
  const configured =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'TESTNET')
      : 'TESTNET';
  return checkNetworkGuard(planNetwork, configured);
}

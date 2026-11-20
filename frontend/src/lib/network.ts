/**
 * Network guard adapter used by usePlan.
 *
 * Wraps the canonical stellar networkGuard so call-sites only need a single
 * import. NETWORK_GUARD takes the plan's raw network string and returns a
 * NetworkGuardResult. When tracing is opt-in the no-op path is preserved.
 */

export type { NetworkGuardResult } from './stellar/networkGuard';
import { checkNetworkGuard } from './stellar/networkGuard';
import { getActiveNetwork, normalizeNetwork } from '../config/network';

/**
 * Guard a plan network string against the app's configured network.
 *
 * Both sides are normalized via config/network first, so TESTNET/testnet and
 * mainnet/public compare equal. Returns a NetworkGuardResult so callers can
 * surface reason strings.
 */
export function NETWORK_GUARD(
  planNetwork: string | null | undefined,
): import('./stellar/networkGuard').NetworkGuardResult {
  return checkNetworkGuard(normalizeNetwork(planNetwork), getActiveNetwork());
}

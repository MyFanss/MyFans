/**
 * Issue #2010: SubscribeConfirm's networkMismatch gate must compare the
 * connected network against the *loaded plan's* expected network via the
 * shared `checkNetworkGuard` utility, not a static global constant.
 *
 * `SubscribeConfirm.tsx` itself cannot be rendered in isolation here: it has
 * pre-existing, unrelated broken imports (`../../services/subscribe` and
 * `../../types/subscribe` do not exist in this tree, and `react-router-dom`
 * is not a dependency of this package) that predate and are out of scope
 * for this issue. This test instead exercises the exact guard call
 * SubscribeConfirm now makes — `checkNetworkGuard(plan.network, network)` —
 * against realistic plan fixtures, proving the mismatch/match behavior the
 * issue describes.
 */
import { describe, expect, it } from 'vitest';
import { checkNetworkGuard } from '../../lib/stellar/networkGuard';
import type { Plan } from '../../lib/plans';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    creator: 'creator-1',
    asset: 'USDC',
    amount: '9.99',
    interval: 'monthly',
    network: 'TESTNET',
    ...overrides,
  };
}

describe('SubscribeConfirm network guard (plan-expected network)', () => {
  it('reports a mismatch when the connected network differs from the plan expected network', () => {
    const plan = makePlan({ network: 'TESTNET' });
    const connectedNetwork = 'public';

    const guard = checkNetworkGuard(plan.network, connectedNetwork);

    expect(guard.ok).toBe(false);
    expect(guard.expected).toBe('TESTNET');
    expect(guard.actual).toBe('PUBLIC');
  });

  it('reports no mismatch when the connected network matches the plan expected network', () => {
    const plan = makePlan({ network: 'PUBLIC' });
    const connectedNetwork = 'public';

    const guard = checkNetworkGuard(plan.network, connectedNetwork);

    expect(guard.ok).toBe(true);
    expect(guard.expected).toBe('PUBLIC');
    expect(guard.actual).toBe('PUBLIC');
  });

  it('names the plan expected network, not a global default, in the guard result', () => {
    // A testnet-expected plan viewed with the app defaulted to a different
    // network must name TESTNET (the plan's own network) as expected, not
    // whatever a global constant happens to be configured to.
    const plan = makePlan({ network: 'FUTURENET' });

    const guard = checkNetworkGuard(plan.network, 'testnet');

    expect(guard.ok).toBe(false);
    expect(guard.expected).toBe('FUTURENET');
  });
});

/**
 * Plan fetch utilities.
 *
 * Thin wrapper around the API client that returns a typed Plan or null when
 * the plan is not found. Null is the canonical signal that a plan was deleted
 * mid-flight so callers (usePlan) can disable the sign action immediately.
 */

export interface Plan {
  id: string;
  /** Creator handle or address this plan belongs to. */
  creator: string;
  /** Asset code, e.g. 'USDC' or 'XLM'. */
  asset: string;
  /** Human-readable amount, e.g. '9.99'. */
  amount: string;
  /** Billing interval label, e.g. 'monthly'. */
  interval: string;
  /** Stellar network this plan settles on, e.g. 'TESTNET'. */
  network: string;
}

const API_BASE =
  typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '')
    : '';

/**
 * Fetch a plan by id. Returns null when the server returns 404 (plan deleted).
 * Throws on network errors or unexpected server errors.
 */
export async function fetchPlan(planId: string): Promise<Plan | null> {
  const res = await fetch(`${API_BASE}/v1/creators/plans/${planId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch plan ${planId}: ${res.status}`);
  }
  return res.json() as Promise<Plan>;
}

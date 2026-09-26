import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlan, type Plan } from '../lib/plans';
import { NETWORK_GUARD, type NetworkGuardResult } from '../lib/network';

export interface PlanConfirmParams {
  asset: string;
  amount: string;
  interval: string;
  network: string;
}

export interface UsePlanResult {
  plan: Plan | null;
  loading: boolean;
  error: string | null;
  /** Live economic parameters that must match the transaction args exactly. */
  confirmParams: PlanConfirmParams | null;
  /** True when the displayed params match the tx args and the network guard passes. */
  canSign: boolean;
  /** Reason the sign action is disabled, if any. */
  mismatchReason: string | null;
  /** Re-fetch the plan (e.g. after a price change or deletion mid-flight). */
  refetch: () => Promise<void>;
}

/**
 * Loads a plan and exposes the exact economic parameters (asset, amount,
 * interval, network) that must be shown to the user before signing.
 *
 * The confirm/sign action is disabled whenever the displayed parameters do
 * not match the transaction args or the NETWORK_GUARD fails. If the plan is
 * deleted mid-flight or its price changes, `refetch` re-loads the plan and
 * updates the displayed values.
 */
export function usePlan(planId: string | undefined): UsePlanResult {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(planId));
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!planId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPlan(planId);
      if (!mountedRef.current) return;
      if (!next) {
        // Plan deleted mid-flight: clear displayed values so sign stays disabled.
        setPlan(null);
        setError('This plan is no longer available.');
        return;
      }
      setPlan(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setPlan(null);
      setError(err instanceof Error ? err.message : 'Failed to load plan.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmParams: PlanConfirmParams | null = plan
    ? {
        asset: plan.asset,
        amount: plan.amount,
        interval: plan.interval,
        network: plan.network,
      }
    : null;

  const guard: NetworkGuardResult = NETWORK_GUARD(plan?.network);

  let mismatchReason: string | null = null;
  if (!plan || !confirmParams) {
    mismatchReason = error ?? 'Plan not loaded.';
  } else if (!guard.ok) {
    mismatchReason = guard.reason ?? 'Network mismatch.';
  } else if (!confirmParams.asset || !confirmParams.amount || !confirmParams.interval) {
    mismatchReason = 'Plan parameters are incomplete.';
  }

  const canSign = mismatchReason === null;

  return {
    plan,
    loading,
    error,
    confirmParams,
    canSign,
    mismatchReason,
    refetch: load,
  };
}

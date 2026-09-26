import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPlan, buildSubscribeTx, signAndSubmit } from '../../services/subscribe';
import { getNetwork, NETWORK_GUARD } from '../../config/network';
import type { Plan, SubscribeTxArgs } from '../../types/subscribe';

interface DisplayedParams {
  asset: string;
  amount: string;
  interval: string;
  network: string;
}

function toDisplayed(plan: Plan, network: string): DisplayedParams {
  return {
    asset: plan.asset,
    amount: plan.amount,
    interval: plan.interval,
    network,
  };
}

function matchesTxArgs(displayed: DisplayedParams, args: SubscribeTxArgs): boolean {
  return (
    displayed.asset === args.asset &&
    displayed.amount === args.amount &&
    displayed.interval === args.interval &&
    displayed.network === args.network
  );
}

export default function SubscribeConfirm() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [txArgs, setTxArgs] = useState<SubscribeTxArgs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);

  const network = getNetwork();

  const load = useCallback(async () => {
    if (!planId) {
      setError('Missing plan id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const freshPlan = await fetchPlan(planId);
      if (!mounted.current) return;
      if (!freshPlan) {
        setPlan(null);
        setTxArgs(null);
        setError('This plan is no longer available.');
        return;
      }
      const args = await buildSubscribeTx(freshPlan, network);
      if (!mounted.current) return;
      setPlan(freshPlan);
      setTxArgs(args);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load plan.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [planId, network]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const displayed = useMemo<DisplayedParams | null>(
    () => (plan ? toDisplayed(plan, network) : null),
    [plan, network],
  );

  const networkMismatch = network !== NETWORK_GUARD;
  const argsMismatch =
    displayed !== null && txArgs !== null && !matchesTxArgs(displayed, txArgs);
  const canSign =
    !loading && !submitting && !error && displayed !== null && txArgs !== null &&
    !networkMismatch && !argsMismatch;

  const handleSign = useCallback(async () => {
    if (!canSign || !txArgs) return;
    setSubmitting(true);
    setError(null);
    try {
      await signAndSubmit(txArgs);
      navigate('/subscriptions');
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Signing failed.');
      // Re-fetch in case the plan changed or was deleted mid-flight.
      void load();
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [canSign, txArgs, navigate, load]);

  if (loading) {
    return <div className="subscribe-confirm">Loading plan…</div>;
  }

  if (error && !plan) {
    return (
      <div className="subscribe-confirm">
        <p role="alert">{error}</p>
        <button type="button" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="subscribe-confirm">
      <h1>Confirm subscription</h1>

      {networkMismatch && (
        <div className="banner banner--error" role="alert">
          Wrong network: connected to {network}, expected {NETWORK_GUARD}.
        </div>
      )}

      {argsMismatch && (
        <div className="banner banner--error" role="alert">
          Plan parameters changed. Review the updated values before signing.
        </div>
      )}

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {displayed && (
        <dl className="subscribe-confirm__params">
          <dt>Asset</dt>
          <dd data-testid="confirm-asset">{displayed.asset}</dd>
          <dt>Amount</dt>
          <dd data-testid="confirm-amount">{displayed.amount}</dd>
          <dt>Interval</dt>
          <dd data-testid="confirm-interval">{displayed.interval}</dd>
          <dt>Network</dt>
          <dd data-testid="confirm-network">{displayed.network}</dd>
        </dl>
      )}

      <div className="subscribe-confirm__actions">
        <button type="button" onClick={() => void load()} disabled={submitting}>
          Refresh
        </button>
        <button
          type="button"
          data-testid="confirm-sign"
          onClick={() => void handleSign()}
          disabled={!canSign}
        >
          {submitting ? 'Signing…' : 'Sign & subscribe'}
        </button>
      </div>
    </div>
  );
}

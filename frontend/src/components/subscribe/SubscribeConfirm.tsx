import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchPlan, type Plan } from '../../lib/plans';
import { getActiveNetwork } from '../../config/network';
import { checkNetworkGuard } from '../../lib/stellar/networkGuard';
import { buildSubscriptionTx, DEFAULT_NETWORK_PASSPHRASE } from '../../lib/stellar';
import { connectFreighter, signSubscribeTransaction } from '../../wallet/freighter';

interface DisplayedParams {
  asset: string;
  amount: string;
  interval: string;
  network: string;
}

interface SubscribeTxArgs extends DisplayedParams {
  /** Amount in stroops, the unit the subscription contract takes. */
  amountStroops: string;
  /** Billing interval in seconds. */
  intervalSeconds: number;
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

/** Plans store intervals as whole days, e.g. '30d' (see dashboard/plans). */
function buildSubscribeTx(plan: Plan, network: string): SubscribeTxArgs {
  const days = /^(\d+)d$/.exec(plan.interval);
  if (!days) throw new Error(`Unsupported billing interval: ${plan.interval}`);
  const stroops = Math.round(Number(plan.amount) * 1e7);
  if (!(stroops > 0)) throw new Error(`Invalid plan amount: ${plan.amount}`);
  return {
    ...toDisplayed(plan, network),
    amountStroops: String(stroops),
    intervalSeconds: Number(days[1]) * 86400,
  };
}

export default function SubscribeConfirm() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [txArgs, setTxArgs] = useState<SubscribeTxArgs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);

  const network = getActiveNetwork();

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
      const args = buildSubscribeTx(freshPlan, network);
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

  // Compare against the plan's own expected network (not a static global
  // constant) via the shared guard utility, so a plan settling on a
  // different network than the app default is neither blocked incorrectly
  // nor allowed to sign under a mismatched network (#2010).
  const networkGuard = plan ? checkNetworkGuard(plan.network, network) : null;
  const networkMismatch = networkGuard !== null && !networkGuard.ok;
  const argsMismatch =
    displayed !== null && txArgs !== null && !matchesTxArgs(displayed, txArgs);
  const canSign =
    !loading && !submitting && !error && displayed !== null && txArgs !== null &&
    !networkMismatch && !argsMismatch;

  const handleSign = useCallback(async () => {
    if (!canSign || !txArgs || !plan) return;
    setSubmitting(true);
    setError(null);
    try {
      const subscriber = await connectFreighter();
      const passphrase =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? DEFAULT_NETWORK_PASSPHRASE;
      const xdr = buildSubscriptionTx({
        sourceAccount: subscriber,
        contractId: process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID ?? '',
        networkPassphrase: passphrase,
        merchant: plan.creator,
        amount: txArgs.amountStroops,
        interval: txArgs.intervalSeconds,
        asset: txArgs.asset,
      });
      await signSubscribeTransaction(xdr, passphrase);
      router.push('/subscriptions');
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Signing failed.');
      // Re-fetch in case the plan changed or was deleted mid-flight.
      void load();
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [canSign, txArgs, plan, router, load]);

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

      {networkMismatch && networkGuard && (
        <div className="banner banner--error" role="alert">
          Wrong network: connected to {networkGuard.actual ?? network}, expected{' '}
          {networkGuard.expected}.
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

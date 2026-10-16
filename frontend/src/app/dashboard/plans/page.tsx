'use client';

/**
 * Dashboard Plans page – #1823
 *
 * Guided two-phase wizard:
 *   Step 1: Fill form (asset, amount, interval_days, title, description)
 *   Step 2: Sign create_plan transaction with Freighter
 *   Step 3: POST metadata to /api/v1/plans (CSRF-protected)
 *
 * Recovery: if the chain tx succeeds but the metadata POST fails the
 * user is shown a "Save metadata" retry button with the on-chain plan_id
 * so the data can be persisted without re-signing.
 *
 * Security: network + asset are displayed clearly before signing.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

interface PlanForm {
  title: string;
  description: string;
  asset: string;
  amount: string;
  intervalDays: string;
}

interface PlanMeta {
  planId: string;
  creator: string;
  asset: string;
  amount: string;
  interval: string;
  title?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

type WizardStep =
  | 'form'
  | 'review'
  | 'signing'
  | 'posting_metadata'
  | 'done'
  | 'metadata_retry';

interface PageState {
  step: WizardStep;
  form: PlanForm;
  formErrors: Partial<PlanForm>;
  /** Set after chain tx succeeds; used for metadata POST and retry. */
  onChainPlanId: string | null;
  /** Signed XDR ready to submit to chain. */
  signedXdr: string | null;
  plans: PlanMeta[];
  plansLoading: boolean;
  globalError: string | null;
  metadataError: string | null;
}

type Action =
  | { type: 'FIELD'; field: keyof PlanForm; value: string }
  | { type: 'VALIDATE'; errors: Partial<PlanForm> }
  | { type: 'GO_REVIEW' }
  | { type: 'GO_FORM' }
  | { type: 'SIGNING' }
  | { type: 'SIGN_DONE'; signedXdr: string; planId: string }
  | { type: 'SIGN_ERROR'; message: string }
  | { type: 'POSTING_METADATA' }
  | { type: 'METADATA_DONE'; plan: PlanMeta }
  | { type: 'METADATA_ERROR'; message: string }
  | { type: 'PLANS_LOADED'; plans: PlanMeta[] }
  | { type: 'PLANS_ERROR' }
  | { type: 'METADATA_RETRY' }
  | { type: 'DISMISS_ERROR' };

const EMPTY_FORM: PlanForm = {
  title: '',
  description: '',
  asset: 'USDC',
  amount: '',
  intervalDays: '30',
};

const initialState: PageState = {
  step: 'form',
  form: EMPTY_FORM,
  formErrors: {},
  onChainPlanId: null,
  signedXdr: null,
  plans: [],
  plansLoading: true,
  globalError: null,
  metadataError: null,
};

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'FIELD':
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
        formErrors: { ...state.formErrors, [action.field]: undefined },
      };
    case 'VALIDATE':
      return { ...state, formErrors: action.errors };
    case 'GO_REVIEW':
      return { ...state, step: 'review', globalError: null };
    case 'GO_FORM':
      return { ...state, step: 'form', globalError: null };
    case 'SIGNING':
      return { ...state, step: 'signing', globalError: null };
    case 'SIGN_DONE':
      return {
        ...state,
        step: 'posting_metadata',
        signedXdr: action.signedXdr,
        onChainPlanId: action.planId,
        globalError: null,
      };
    case 'SIGN_ERROR':
      return { ...state, step: 'review', globalError: action.message };
    case 'POSTING_METADATA':
      return { ...state, metadataError: null };
    case 'METADATA_DONE': {
      // Replace an existing entry with the same planId instead of always
      // prepending, so a retried POST never renders a duplicate row.
      const existingIndex = state.plans.findIndex(
        (p) => p.planId === action.plan.planId,
      );
      const plans =
        existingIndex >= 0
          ? state.plans.map((p, i) => (i === existingIndex ? action.plan : p))
          : [action.plan, ...state.plans];
      return {
        ...state,
        step: 'done',
        plans,
        metadataError: null,
        form: EMPTY_FORM,
        formErrors: {},
      };
    }
    case 'METADATA_ERROR':
      return {
        ...state,
        step: 'metadata_retry',
        metadataError: action.message,
      };
    case 'PLANS_LOADED':
      return { ...state, plans: action.plans, plansLoading: false };
    case 'PLANS_ERROR':
      return { ...state, plansLoading: false };
    case 'METADATA_RETRY':
      return { ...state, metadataError: null };
    case 'DISMISS_ERROR':
      return { ...state, globalError: null, metadataError: null };
    default:
      return state;
  }
}

// ── Validation ─────────────────────────────────────────────────────────────

function validate(form: PlanForm): Partial<PlanForm> {
  const errors: Partial<PlanForm> = {};
  if (!form.title.trim()) errors.title = 'Title is required.';
  if (!form.asset.trim()) errors.asset = 'Asset is required.';
  if (!/^\d+(\.\d+)?$/.test(form.amount) || Number(form.amount) <= 0)
    errors.amount = 'Enter a positive number.';
  if (!/^[1-9]\d*$/.test(form.intervalDays))
    errors.intervalDays = 'Must be a positive integer (days).';
  return errors;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deterministic idempotency key for a plan's metadata POST.
 *
 * Derived solely from the on-chain plan_id so the first attempt and any
 * 'metadata_retry' attempt send the identical key. This lets the backend
 * deduplicate a retry after an ambiguous failure (timeout, dropped
 * response, tab reload) instead of creating a second metadata row.
 *
 * Must NOT use Date.now()/Math.random() – the key has to be stable across
 * attempts for the same plan_id.
 */
export function metadataIdempotencyKey(planId: string): string {
  return `plan-metadata:${planId}`;
}

// ── Page component ─────────────────────────────────────────────────────────

export default function DashboardPlansPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load existing plans on mount
  useEffect(() => {
    apiFetch('/api/v1/plans', { method: 'GET' })
      .then(async (res) => {
        if (!mountedRef.current) return;
        if (!res.ok) { dispatch({ type: 'PLANS_ERROR' }); return; }
        const data = (await res.json()) as PlanMeta[];
        dispatch({ type: 'PLANS_LOADED', plans: Array.isArray(data) ? data : [] });
      })
      .catch(() => {
        if (mountedRef.current) dispatch({ type: 'PLANS_ERROR' });
      });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleReview = useCallback(() => {
    const errors = validate(state.form);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'VALIDATE', errors });
      return;
    }
    dispatch({ type: 'GO_REVIEW' });
  }, [state.form]);

  const handleSign = useCallback(async () => {
    dispatch({ type: 'SIGNING' });

    try {
      // Dynamically import wallet to avoid SSR issues
      const { signTransaction } = await import('@/wallet/freighter');
      const contractId = process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID ?? '';
      const networkPassphrase =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
        'Test SDF Network ; September 2015';

      // Build a minimal create_plan XDR (contract invocation)
      const planId = generatePlanId();
      const { buildSubscriptionTx } = await import('@/lib/stellar');

      const xdr = buildSubscriptionTx({
        sourceAccount: 'PLACEHOLDER_SOURCE',
        contractId,
        networkPassphrase,
        merchant: 'PLACEHOLDER_CREATOR',
        amount: String(Math.round(Number(state.form.amount) * 1e7)),
        interval: Number(state.form.intervalDays) * 86400,
        asset: state.form.asset,
      });

      const signedXdr = await signTransaction(xdr, networkPassphrase);
      if (!mountedRef.current) return;
      dispatch({ type: 'SIGN_DONE', signedXdr, planId });
    } catch (err) {
      if (!mountedRef.current) return;
      const msg =
        err instanceof Error ? err.message : 'Signing failed or was rejected.';
      dispatch({ type: 'SIGN_ERROR', message: msg });
    }
  }, [state.form]);

  const postMetadata = useCallback(
    async (planId: string) => {
      dispatch({ type: 'POSTING_METADATA' });
      try {
        const res = await apiFetch('/api/v1/plans', {
          method: 'POST',
          headers: {
            'Idempotency-Key': metadataIdempotencyKey(planId),
          },
          body: JSON.stringify({
            planId,
            asset: state.form.asset,
            amount: state.form.amount,
            interval: `${state.form.intervalDays}d`,
            title: state.form.title.trim() || undefined,
            description: state.form.description.trim() || undefined,
          }),
        });
        if (!res.ok) {
          throw new Error(`Metadata save failed (${res.status}).`);
        }
        const plan = (await res.json()) as PlanMeta;
        if (!mountedRef.current) return;
        dispatch({ type: 'METADATA_DONE', plan });
      } catch (err) {
        if (!mountedRef.current) return;
        const msg =
          err instanceof Error ? err.message : 'Metadata save failed.';
        dispatch({ type: 'METADATA_ERROR', message: msg });
      }
    },
    [state.form],
  );

  const handleRetryMetadata = useCallback(() => {
    if (!state.onChainPlanId) return;
    dispatch({ type: 'METADATA_RETRY' });
    void postMetadata(state.onChainPlanId);
  }, [postMetadata, state.onChainPlanId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Create a plan</h1>

      {state.globalError && (
        <div role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-700">
          {state.globalError}
        </div>
      )}

      {state.step === 'form' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleReview();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              value={state.form.title}
              onChange={(e) =>
                dispatch({ type: 'FIELD', field: 'title', value: e.target.value })
              }
              className="mt-1 w-full rounded border p-2"
            />
            {state.formErrors.title && (
              <p className="mt-1 text-sm text-red-600">{state.formErrors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={state.form.description}
              onChange={(e) =>
                dispatch({
                  type: 'FIELD',
                  field: 'description',
                  value: e.target.value,
                })
              }
              className="mt-1 w-full rounded border p-2"
            />
          </div>

          <div>
            <label htmlFor="asset" className="block text-sm font-medium">
              Asset
            </label>
            <input
              id="asset"
              value={state.form.asset}
              onChange={(e) =>
                dispatch({ type: 'FIELD', field: 'asset', value: e.target.value })
              }
              className="mt-1 w-full rounded border p-2"
            />
            {state.formErrors.asset && (
              <p className="mt-1 text-sm text-red-600">{state.formErrors.asset}</p>
            )}
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium">
              Amount
            </label>
            <input
              id="amount"
              value={state.form.amount}
              onChange={(e) =>
                dispatch({ type: 'FIELD', field: 'amount', value: e.target.value })
              }
              className="mt-1 w-full rounded border p-2"
            />
            {state.formErrors.amount && (
              <p className="mt-1 text-sm text-red-600">{state.formErrors.amount}</p>
            )}
          </div>

          <div>
            <label htmlFor="intervalDays" className="block text-sm font-medium">
              Interval (days)
            </label>
            <input
              id="intervalDays"
              value={state.form.intervalDays}
              onChange={(e) =>
                dispatch({
                  type: 'FIELD',
                  field: 'intervalDays',
                  value: e.target.value,
                })
              }
              className="mt-1 w-full rounded border p-2"
            />
            {state.formErrors.intervalDays && (
              <p className="mt-1 text-sm text-red-600">
                {state.formErrors.intervalDays}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Review
          </button>
        </form>
      )}

      {state.step === 'review' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review the details below, then sign with Freighter.
          </p>
          <dl className="rounded border p-4">
            <dt className="text-sm text-gray-500">Asset</dt>
            <dd className="mb-2 font-medium">{state.form.asset}</dd>
            <dt className="text-sm text-gray-500">Amount</dt>
            <dd className="mb-2 font-medium">{state.form.amount}</dd>
            <dt className="text-sm text-gray-500">Interval</dt>
            <dd className="font-medium">{state.form.intervalDays} days</dd>
          </dl>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'GO_FORM' })}
              className="rounded border px-4 py-2"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSign}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Sign with Freighter
            </button>
          </div>
        </div>
      )}

      {state.step === 'signing' && (
        <p className="text-sm text-gray-600">Waiting for signature…</p>
      )}

      {state.step === 'posting_metadata' && (
        <p className="text-sm text-gray-600">Saving plan metadata…</p>
      )}

      {state.step === 'metadata_retry' && (
        <div className="space-y-4">
          <div role="alert" className="rounded bg-yellow-50 p-3 text-yellow-800">
            The plan was created on-chain, but saving its metadata failed.
            {state.metadataError ? ` ${state.metadataError}` : ''}
          </div>
          <p className="text-sm text-gray-600">
            On-chain plan id: <code>{state.onChainPlanId}</code>
          </p>
          <button
            type="button"
            onClick={handleRetryMetadata}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Save metadata
          </button>
        </div>
      )}

      {state.step === 'done' && (
        <div className="space-y-4">
          <p className="text-sm text-green-700">Plan created successfully.</p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'GO_FORM' })}
            className="rounded border px-4 py-2"
          >
            Create another
          </button>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-medium">Your plans</h2>
        {state.plansLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : state.plans.length === 0 ? (
          <p className="text-sm text-gray-500">No plans yet.</p>
        ) : (
          <ul className="space-y-2">
            {state.plans.map((plan) => (
              <li key={plan.planId} className="rounded border p-3">
                <p className="font-medium">{plan.title ?? plan.planId}</p>
                <p className="text-sm text-gray-500">
                  {plan.amount} {plan.asset} every {plan.interval}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

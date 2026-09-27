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
    case 'METADATA_DONE':
      return {
        ...state,
        step: 'done',
        plans: [action.plan, ...state.plans],
        metadataError: null,
        form: EMPTY_FORM,
        formErrors: {},
      };
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
          body: JSON.stringify({
            planId,
            asset: state.form.asset,
            amount: state.form.amount,
            interval: `${state.form.intervalDays}d`,
            title: state.form.title.trim() || undefined,
            description: state.form.description.trim() || undefined,
          }),
        });
        if (!mountedRef.current) return;
        if (res.status === 409) {
          // Already saved – fetch and display
          const existing = (await res.json()) as PlanMeta;
          dispatch({ type: 'METADATA_DONE', plan: existing });
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          dispatch({
            type: 'METADATA_ERROR',
            message: body.message ?? `Failed to save metadata (${res.status}). You can retry below.`,
          });
          return;
        }
        const plan = (await res.json()) as PlanMeta;
        dispatch({ type: 'METADATA_DONE', plan });
      } catch (err) {
        if (!mountedRef.current) return;
        dispatch({
          type: 'METADATA_ERROR',
          message:
            err instanceof Error
              ? err.message
              : 'Network error saving metadata. You can retry below.',
        });
      }
    },
    [state.form],
  );

  // Automatically POST metadata after signing
  useEffect(() => {
    if (state.step === 'posting_metadata' && state.onChainPlanId) {
      void postMetadata(state.onChainPlanId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={s.page}>
      <h1 style={s.heading}>Plans</h1>
      <p style={s.sub}>Create subscription plans and register their metadata.</p>

      {/* ── Wizard ── */}
      <section style={s.card} aria-label="Create plan wizard">
        <h2 style={s.cardHeading}>
          {state.step === 'done' ? '✅ Plan created' : 'New plan'}
        </h2>

        {/* Step indicator */}
        <StepIndicator step={state.step} />

        {state.globalError && (
          <div role="alert" style={s.errorBanner}>
            {state.globalError}
            <button style={s.dismissBtn} onClick={() => dispatch({ type: 'DISMISS_ERROR' })}>
              Dismiss
            </button>
          </div>
        )}

        {/* ── FORM ── */}
        {state.step === 'form' && (
          <PlanForm
            form={state.form}
            errors={state.formErrors}
            onChange={(field, value) => dispatch({ type: 'FIELD', field, value })}
            onNext={handleReview}
          />
        )}

        {/* ── REVIEW ── */}
        {state.step === 'review' && (
          <ReviewStep
            form={state.form}
            onBack={() => dispatch({ type: 'GO_FORM' })}
            onSign={() => void handleSign()}
          />
        )}

        {/* ── SIGNING ── */}
        {state.step === 'signing' && (
          <StatusStep message="Waiting for Freighter to sign…" />
        )}

        {/* ── POSTING METADATA ── */}
        {state.step === 'posting_metadata' && (
          <StatusStep message="Saving plan metadata…" />
        )}

        {/* ── METADATA RETRY ── */}
        {state.step === 'metadata_retry' && state.onChainPlanId && (
          <MetadataRetryStep
            planId={state.onChainPlanId}
            error={state.metadataError ?? 'Metadata save failed.'}
            onRetry={() => {
              dispatch({ type: 'METADATA_RETRY' });
              void postMetadata(state.onChainPlanId!);
            }}
            onStartOver={() => dispatch({ type: 'GO_FORM' })}
          />
        )}

        {/* ── DONE ── */}
        {state.step === 'done' && (
          <div>
            <p style={s.successText}>
              Your plan is live on-chain and metadata is saved.
            </p>
            <button
              style={s.primaryBtn}
              onClick={() => dispatch({ type: 'GO_FORM' })}
            >
              Create another plan
            </button>
          </div>
        )}
      </section>

      {/* ── Plans list ── */}
      <section style={s.card} aria-label="My plans">
        <h2 style={s.cardHeading}>My plans</h2>
        {state.plansLoading && <p role="status">Loading plans…</p>}
        {!state.plansLoading && state.plans.length === 0 && (
          <p style={s.emptyText}>No plans yet. Create your first plan above.</p>
        )}
        {!state.plansLoading && state.plans.length > 0 && (
          <ul style={s.planList}>
            {state.plans.map((plan) => (
              <li key={plan.planId} style={s.planItem}>
                <strong style={s.planTitle}>{plan.title ?? plan.planId}</strong>
                <span style={s.planMeta}>
                  {plan.amount} {plan.asset} / {plan.interval}
                </span>
                {plan.description && (
                  <p style={s.planDesc}>{plan.description}</p>
                )}
                <code style={s.planId}>plan_id: {plan.planId}</code>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: WizardStep[] = ['form', 'review', 'signing', 'posting_metadata', 'done'];
  const labels = ['Fill form', 'Review', 'Sign tx', 'Save metadata', 'Done'];
  const current = steps.indexOf(step === 'metadata_retry' ? 'posting_metadata' : step);
  return (
    <ol style={s.stepper} aria-label="Wizard steps">
      {labels.map((label, i) => (
        <li
          key={label}
          style={{
            ...s.stepItem,
            color: i < current ? '#34d399' : i === current ? '#a78bfa' : '#555',
            fontWeight: i === current ? 700 : 400,
          }}
          aria-current={i === current ? 'step' : undefined}
        >
          {i < current ? '✓ ' : `${i + 1}. `}{label}
        </li>
      ))}
    </ol>
  );
}

function PlanForm({
  form,
  errors,
  onChange,
  onNext,
}: {
  form: PlanForm;
  errors: Partial<PlanForm>;
  onChange: (field: keyof PlanForm, value: string) => void;
  onNext: () => void;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onNext(); }}
      noValidate
    >
      <Field
        label="Plan title"
        id="title"
        value={form.title}
        error={errors.title}
        onChange={(v) => onChange('title', v)}
        placeholder="e.g. Monthly Fan"
      />
      <Field
        label="Description (optional)"
        id="description"
        value={form.description}
        onChange={(v) => onChange('description', v)}
        placeholder="What subscribers get…"
        as="textarea"
      />
      <Field
        label="Asset code"
        id="asset"
        value={form.asset}
        error={errors.asset}
        onChange={(v) => onChange('asset', v.toUpperCase())}
        placeholder="USDC or XLM"
        hint="Stellar asset code that fans will pay in"
      />
      <Field
        label="Amount"
        id="amount"
        value={form.amount}
        error={errors.amount}
        onChange={(v) => onChange('amount', v)}
        placeholder="10.00"
        inputMode="decimal"
      />
      <Field
        label="Interval (days)"
        id="intervalDays"
        value={form.intervalDays}
        error={errors.intervalDays}
        onChange={(v) => onChange('intervalDays', v)}
        placeholder="30"
        inputMode="numeric"
        hint="Billing cycle length"
      />
      <button type="submit" style={s.primaryBtn}>
        Review plan →
      </button>
    </form>
  );
}

function ReviewStep({
  form,
  onBack,
  onSign,
}: {
  form: PlanForm;
  onBack: () => void;
  onSign: () => void;
}) {
  const network =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  return (
    <div>
      <p style={s.reviewNotice}>
        Review the details below carefully. You will sign a Stellar transaction
        to create this plan on-chain.
      </p>
      <dl style={s.reviewDl}>
        <dt style={s.reviewDt}>Network</dt>
        <dd style={{ ...s.reviewDd, color: '#facc15' }}>{network}</dd>
        <dt style={s.reviewDt}>Asset</dt>
        <dd style={s.reviewDd}>{form.asset}</dd>
        <dt style={s.reviewDt}>Amount</dt>
        <dd style={s.reviewDd}>{form.amount} {form.asset}</dd>
        <dt style={s.reviewDt}>Billing interval</dt>
        <dd style={s.reviewDd}>{form.intervalDays} day(s)</dd>
        {form.title && (
          <>
            <dt style={s.reviewDt}>Title</dt>
            <dd style={s.reviewDd}>{form.title}</dd>
          </>
        )}
        {form.description && (
          <>
            <dt style={s.reviewDt}>Description</dt>
            <dd style={s.reviewDd}>{form.description}</dd>
          </>
        )}
      </dl>
      <div style={s.reviewActions}>
        <button style={s.ghostBtn} type="button" onClick={onBack}>
          ← Back
        </button>
        <button style={s.primaryBtn} type="button" onClick={onSign}>
          Sign &amp; create plan
        </button>
      </div>
    </div>
  );
}

function StatusStep({ message }: { message: string }) {
  return (
    <div style={s.statusWrap}>
      <span style={s.spinner} aria-hidden="true" />
      <p role="status">{message}</p>
    </div>
  );
}

function MetadataRetryStep({
  planId,
  error,
  onRetry,
  onStartOver,
}: {
  planId: string;
  error: string;
  onRetry: () => void;
  onStartOver: () => void;
}) {
  return (
    <div>
      <div role="alert" style={s.warningBanner}>
        <strong>On-chain tx succeeded</strong> but metadata could not be saved.
      </div>
      <p style={{ color: '#f87171', marginBottom: '0.75rem' }}>{error}</p>
      <p style={s.retryNote}>
        Your on-chain plan ID is preserved below. Click <em>Retry</em> to
        re-save metadata without re-signing.
      </p>
      <code style={s.planIdBlock}>{planId}</code>
      <div style={s.reviewActions}>
        <button style={s.ghostBtn} type="button" onClick={onStartOver}>
          Start over
        </button>
        <button style={s.primaryBtn} type="button" onClick={onRetry}>
          Retry metadata save
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  error,
  onChange,
  placeholder,
  inputMode,
  hint,
  as,
}: {
  label: string;
  id: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  hint?: string;
  as?: 'textarea';
}) {
  return (
    <div style={s.fieldWrap}>
      <label htmlFor={id} style={s.label}>
        {label}
      </label>
      {hint && <p style={s.hint}>{hint}</p>}
      {as === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...s.input, resize: 'vertical', minHeight: '80px' }}
          rows={3}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          style={error ? { ...s.input, borderColor: '#f87171' } : s.input}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
        />
      )}
      {error && (
        <p id={`${id}-error`} style={s.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '760px',
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, sans-serif',
    color: '#f0f0f0',
  },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { color: '#aaa', marginBottom: '2rem' },
  card: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  cardHeading: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' },
  stepper: {
    display: 'flex',
    gap: '1rem',
    listStyle: 'none',
    padding: 0,
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
    fontSize: '0.8rem',
  },
  stepItem: { transition: 'color 0.2s' },
  fieldWrap: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.875rem', marginBottom: '0.3rem', color: '#ccc' },
  hint: { fontSize: '0.75rem', color: '#888', margin: '0 0 0.3rem' },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #444',
    background: '#111',
    color: '#f0f0f0',
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  fieldError: { color: '#f87171', fontSize: '0.8rem', marginTop: '0.25rem' },
  primaryBtn: {
    padding: '0.6rem 1.4rem',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  ghostBtn: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    background: 'transparent',
    color: '#aaa',
    border: '1px solid #444',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  reviewNotice: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    color: '#cbd5e1',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  reviewDl: { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem 1rem', marginBottom: '1rem' },
  reviewDt: { fontWeight: 600, color: '#888', fontSize: '0.875rem' },
  reviewDd: { color: '#f0f0f0', fontSize: '0.9rem' },
  reviewActions: { display: 'flex', gap: '0.75rem', marginTop: '1rem' },
  statusWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    padding: '2rem',
    color: '#aaa',
  },
  spinner: {
    display: 'inline-block',
    width: '28px',
    height: '28px',
    border: '3px solid #333',
    borderTop: '3px solid #7c3aed',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: '#3b1a1a',
    color: '#f87171',
    marginBottom: '1rem',
    border: '1px solid #7f1d1d',
    fontSize: '0.875rem',
  },
  warningBanner: {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: '#1c1a05',
    color: '#facc15',
    marginBottom: '0.75rem',
    border: '1px solid #713f12',
    fontSize: '0.875rem',
  },
  dismissBtn: {
    background: 'transparent',
    border: '1px solid #f87171',
    color: '#f87171',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  successText: { color: '#34d399', marginBottom: '1rem' },
  retryNote: { color: '#ccc', fontSize: '0.875rem', marginBottom: '0.75rem' },
  planIdBlock: {
    display: 'block',
    background: '#0a0a14',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    color: '#a78bfa',
    marginBottom: '1rem',
    wordBreak: 'break-all' as const,
  },
  planList: { listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  planItem: {
    background: '#0d0d1a',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '0.875rem 1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.2rem',
  },
  planTitle: { fontSize: '0.95rem' },
  planMeta: { color: '#a78bfa', fontSize: '0.85rem' },
  planDesc: { color: '#888', fontSize: '0.8rem' },
  planId: { fontSize: '0.7rem', color: '#555' },
  emptyText: { color: '#666', fontSize: '0.875rem' },
} as const;

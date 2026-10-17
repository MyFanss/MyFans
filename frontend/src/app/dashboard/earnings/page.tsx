'use client';

/**
 * Earnings pages – #1825
 *
 * Displays live creator balances + payment history from the EarningsModule
 * via GET /api/v1/earnings/balances and GET /api/v1/earnings/history.
 *
 * Withdraw flow (prepare/sign/confirm):
 *   1. Creator enters amount → POST /api/v1/earnings/withdraw/prepare
 *      → receives an unsigned tx XDR.
 *   2. Freighter signs the XDR.
 *   3. POST /api/v1/earnings/withdraw/confirm with signedXdr.
 *
 * Error handling:
 *   - Insufficient funds: surfaced from the prepare response.
 *   - Wrong network: caught from the Freighter network guard before signing.
 *   - Unauthenticated: a 401 from either endpoint shows a "creator-only" note.
 *
 * Security: This page is gated to creator role via middleware (the
 * `CreatorAuthGuard` on the backend; see frontend middleware.ts for the
 * route-level auth check). A 401/403 from either endpoint shows a clear
 * "creator-only" message rather than leaking earnings data.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface Balance {
  asset: string;
  available: string;
  pending: string;
  currency: string;
}

interface EarningsHistoryEntry {
  id: string;
  amount: string;
  asset: string;
  type: 'subscription' | 'tip' | 'withdraw';
  status: string;
  createdAt: string;
  txHash?: string | null;
}

interface EarningsBalanceResponse {
  balances: Balance[];
  updatedAt: string;
}

interface EarningsHistoryResponse {
  data: EarningsHistoryEntry[];
  nextCursor: string | null;
}

interface PrepareWithdrawResponse {
  xdr: string;
  amount: string;
  asset: string;
  estimatedFee?: string;
}

type WithdrawStep = 'idle' | 'preparing' | 'signing' | 'confirming' | 'done';

interface PageState {
  // Balances
  balances: Balance[];
  balancesLoading: boolean;
  balancesError: string | null;

  // History
  history: EarningsHistoryEntry[];
  historyLoading: boolean;
  historyError: string | null;
  historyCursor: string | null;
  historyHasMore: boolean;

  // Withdraw wizard
  withdrawAmount: string;
  withdrawAsset: string;
  withdrawStep: WithdrawStep;
  withdrawError: string | null;
  pendingXdr: string | null;
  withdrawResult: { txHash?: string | null; amount: string; asset: string } | null;

  // Auth
  unauthorized: boolean;
}

type Action =
  | { type: 'BALANCES_LOADED'; balances: Balance[] }
  | { type: 'BALANCES_ERROR'; message: string }
  | { type: 'HISTORY_LOADED'; entries: EarningsHistoryEntry[]; cursor: string | null; append: boolean }
  | { type: 'HISTORY_ERROR'; message: string }
  | { type: 'WITHDRAW_AMOUNT'; value: string }
  | { type: 'WITHDRAW_ASSET'; value: string }
  | { type: 'WITHDRAW_PREPARING' }
  | { type: 'WITHDRAW_SIGNING'; xdr: string }
  | { type: 'WITHDRAW_CONFIRMING'; signedXdr: string }
  | { type: 'WITHDRAW_DONE'; result: { txHash?: string | null; amount: string; asset: string } }
  | { type: 'WITHDRAW_ERROR'; message: string }
  | { type: 'WITHDRAW_RESET' }
  | { type: 'UNAUTHORIZED' };

const initialState: PageState = {
  balances: [],
  balancesLoading: true,
  balancesError: null,
  history: [],
  historyLoading: true,
  historyError: null,
  historyCursor: null,
  historyHasMore: false,
  withdrawAmount: '',
  withdrawAsset: 'USDC',
  withdrawStep: 'idle',
  withdrawError: null,
  pendingXdr: null,
  withdrawResult: null,
  unauthorized: false,
};

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'BALANCES_LOADED':
      return { ...state, balancesLoading: false, balancesError: null, balances: action.balances };
    case 'BALANCES_ERROR':
      return { ...state, balancesLoading: false, balancesError: action.message };
    case 'HISTORY_LOADED':
      return {
        ...state,
        historyLoading: false,
        historyError: null,
        history: action.append ? [...state.history, ...action.entries] : action.entries,
        historyCursor: action.cursor,
        historyHasMore: !!action.cursor,
      };
    case 'HISTORY_ERROR':
      return { ...state, historyLoading: false, historyError: action.message };
    case 'WITHDRAW_AMOUNT':
      return { ...state, withdrawAmount: action.value, withdrawError: null };
    case 'WITHDRAW_ASSET':
      return { ...state, withdrawAsset: action.value, withdrawError: null };
    case 'WITHDRAW_PREPARING':
      return { ...state, withdrawStep: 'preparing', withdrawError: null };
    case 'WITHDRAW_SIGNING':
      return { ...state, withdrawStep: 'signing', pendingXdr: action.xdr };
    case 'WITHDRAW_CONFIRMING':
      return { ...state, withdrawStep: 'confirming' };
    case 'WITHDRAW_DONE':
      return { ...state, withdrawStep: 'done', withdrawResult: action.result, pendingXdr: null };
    case 'WITHDRAW_ERROR':
      return { ...state, withdrawStep: 'idle', withdrawError: action.message, pendingXdr: null };
    case 'WITHDRAW_RESET':
      return { ...state, withdrawStep: 'idle', withdrawError: null, pendingXdr: null, withdrawResult: null, withdrawAmount: '' };
    case 'UNAUTHORIZED':
      return {
        ...state,
        balancesLoading: false,
        historyLoading: false,
        unauthorized: true,
      };
    default:
      return state;
  }
}

// ── Page component ─────────────────────────────────────────────────────────

export default function DashboardEarningsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load balances
  useEffect(() => {
    apiFetch('/api/v1/earnings/balances', { method: 'GET' })
      .then(async (res) => {
        if (!mountedRef.current) return;
        if (res.status === 401 || res.status === 403) {
          dispatch({ type: 'UNAUTHORIZED' });
          return;
        }
        if (!res.ok) {
          dispatch({ type: 'BALANCES_ERROR', message: `Failed to load balances (${res.status})` });
          return;
        }
        const data = (await res.json()) as EarningsBalanceResponse;
        dispatch({ type: 'BALANCES_LOADED', balances: data.balances ?? [] });
      })
      .catch((err) => {
        if (mountedRef.current)
          dispatch({ type: 'BALANCES_ERROR', message: err instanceof Error ? err.message : 'Network error' });
      });
  }, []);

  // Load history
  const loadHistory = useCallback(async (cursor: string | null, append: boolean) => {
    const params = new URLSearchParams({ limit: '20' });
    if (cursor) params.set('cursor', cursor);
    try {
      const res = await apiFetch(`/api/v1/earnings/history?${params.toString()}`, { method: 'GET' });
      if (!mountedRef.current) return;
      if (res.status === 401 || res.status === 403) {
        dispatch({ type: 'UNAUTHORIZED' });
        return;
      }
      if (!res.ok) {
        dispatch({ type: 'HISTORY_ERROR', message: `Failed to load history (${res.status})` });
        return;
      }
      const data = (await res.json()) as EarningsHistoryResponse | EarningsHistoryEntry[];
      const entries = Array.isArray(data) ? data : data.data ?? [];
      const next = Array.isArray(data) ? null : (data.nextCursor ?? null);
      dispatch({ type: 'HISTORY_LOADED', entries, cursor: next, append });
    } catch (err) {
      if (mountedRef.current)
        dispatch({ type: 'HISTORY_ERROR', message: err instanceof Error ? err.message : 'Network error' });
    }
  }, []);

  useEffect(() => {
    void loadHistory(null, false);
  }, [loadHistory]);

  // ── Withdraw flow ─────────────────────────────────────────────────────────

  const handleWithdraw = useCallback(async () => {
    if (!state.withdrawAmount || Number(state.withdrawAmount) <= 0) {
      dispatch({ type: 'WITHDRAW_ERROR', message: 'Enter a positive amount.' });
      return;
    }

    dispatch({ type: 'WITHDRAW_PREPARING' });

    try {
      // Step 1: prepare
      const prepRes = await apiFetch('/api/v1/earnings/withdraw/prepare', {
        method: 'POST',
        body: JSON.stringify({ amount: state.withdrawAmount, asset: state.withdrawAsset }),
        idempotencyKey: `withdraw-${Date.now()}`,
      });

      if (!mountedRef.current) return;

      if (prepRes.status === 401 || prepRes.status === 403) {
        dispatch({ type: 'UNAUTHORIZED' });
        return;
      }
      if (!prepRes.ok) {
        const body = (await prepRes.json().catch(() => ({}))) as { message?: string };
        dispatch({
          type: 'WITHDRAW_ERROR',
          message: body.message ?? `Prepare failed (${prepRes.status})`,
        });
        return;
      }

      const prep = (await prepRes.json()) as PrepareWithdrawResponse;
      dispatch({ type: 'WITHDRAW_SIGNING', xdr: prep.xdr });

      // Step 2: sign
      const { signTransaction } = await import('@/wallet/freighter');
      const networkPassphrase =
        process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
        'Test SDF Network ; September 2015';

      const signedXdr = await signTransaction(prep.xdr, networkPassphrase);
      if (!mountedRef.current) return;

      dispatch({ type: 'WITHDRAW_CONFIRMING', signedXdr });

      // Step 3: confirm
      const confirmRes = await apiFetch('/api/v1/earnings/withdraw/confirm', {
        method: 'POST',
        body: JSON.stringify({ signedXdr, amount: prep.amount, asset: prep.asset }),
        idempotencyKey: `withdraw-confirm-${Date.now()}`,
      });

      if (!mountedRef.current) return;

      if (!confirmRes.ok) {
        const body = (await confirmRes.json().catch(() => ({}))) as { message?: string };
        dispatch({
          type: 'WITHDRAW_ERROR',
          message: body.message ?? `Confirmation failed (${confirmRes.status})`,
        });
        return;
      }

      const confirmed = (await confirmRes.json()) as { txHash?: string | null };
      dispatch({
        type: 'WITHDRAW_DONE',
        result: { txHash: confirmed.txHash, amount: prep.amount, asset: prep.asset },
      });
    } catch (err) {
      if (!mountedRef.current) return;
      dispatch({
        type: 'WITHDRAW_ERROR',
        message: err instanceof Error ? err.message : 'Withdraw failed. Please try again.',
      });
    }
  }, [state.withdrawAmount, state.withdrawAsset]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (state.unauthorized) {
    return (
      <main style={s.page}>
        <h1 style={s.heading}>Earnings</h1>
        <div role="alert" style={s.authError}>
          <strong>Creator-only route.</strong> Sign in with a creator account to view earnings.
        </div>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <h1 style={s.heading}>Earnings</h1>
      <p style={s.sub}>Live balances and payment history from your subscription plans.</p>

      {/* ── Balances ── */}
      <section style={s.card} aria-label="Balances">
        <h2 style={s.cardHeading}>Balances</h2>
        {state.balancesLoading && <p role="status">Loading balances…</p>}
        {state.balancesError && (
          <p role="alert" style={s.inlineError}>{state.balancesError}</p>
        )}
        {!state.balancesLoading && !state.balancesError && state.balances.length === 0 && (
          <p style={s.emptyText}>No balance data yet.</p>
        )}
        {state.balances.length > 0 && (
          <ul style={s.balanceList}>
            {state.balances.map((b) => (
              <li key={b.asset} style={s.balanceItem}>
                <span style={s.balanceAsset}>{b.asset}</span>
                <div style={s.balanceAmounts}>
                  <span style={s.balanceAvailable}>{b.available} available</span>
                  {Number(b.pending) > 0 && (
                    <span style={s.balancePending}>{b.pending} pending</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Withdraw wizard ── */}
      <section style={s.card} aria-label="Withdraw earnings">
        <h2 style={s.cardHeading}>Withdraw</h2>

        {state.withdrawStep === 'done' && state.withdrawResult ? (
          <WithdrawSuccess
            result={state.withdrawResult}
            onReset={() => {
              dispatch({ type: 'WITHDRAW_RESET' });
              void loadHistory(null, false);
            }}
          />
        ) : (
          <>
            {state.withdrawError && (
              <div role="alert" style={s.errorBanner}>
                {state.withdrawError}
              </div>
            )}

            {(state.withdrawStep === 'preparing' ||
              state.withdrawStep === 'signing' ||
              state.withdrawStep === 'confirming') ? (
              <WithdrawProgress step={state.withdrawStep} />
            ) : (
              <WithdrawForm
                amount={state.withdrawAmount}
                asset={state.withdrawAsset}
                balances={state.balances}
                onAmountChange={(v) => dispatch({ type: 'WITHDRAW_AMOUNT', value: v })}
                onAssetChange={(v) => dispatch({ type: 'WITHDRAW_ASSET', value: v })}
                onSubmit={() => void handleWithdraw()}
              />
            )}
          </>
        )}
      </section>

      {/* ── Payment history ── */}
      <section style={s.card} aria-label="Payment history">
        <h2 style={s.cardHeading}>History</h2>
        {state.historyLoading && state.history.length === 0 && (
          <p role="status">Loading history…</p>
        )}
        {state.historyError && (
          <p role="alert" style={s.inlineError}>{state.historyError}</p>
        )}
        {!state.historyLoading && !state.historyError && state.history.length === 0 && (
          <p style={s.emptyText}>No payment history yet.</p>
        )}
        {state.history.length > 0 && (
          <>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th} scope="col">Date</th>
                    <th style={s.th} scope="col">Type</th>
                    <th style={s.th} scope="col">Amount</th>
                    <th style={s.th} scope="col">Status</th>
                    <th style={s.th} scope="col">Tx hash</th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.map((entry) => (
                    <tr key={entry.id} style={s.tr}>
                      <td style={s.td}>
                        <time dateTime={entry.createdAt}>
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </time>
                      </td>
                      <td style={s.td}>{entry.type}</td>
                      <td style={s.tdAmount}>
                        {entry.amount} {entry.asset}
                      </td>
                      <td style={s.td}>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td style={s.tdMono}>
                        {entry.txHash && /^[0-9a-fA-F]{64}$/.test(entry.txHash) ? (
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={s.txLink}
                          >
                            {entry.txHash.slice(0, 8)}…{entry.txHash.slice(-6)}
                          </a>
                        ) : (
                          <span style={{ color: '#555' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.historyHasMore && (
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  style={s.ghostBtn}
                  type="button"
                  onClick={() => void loadHistory(state.historyCursor, true)}
                  disabled={state.historyLoading}
                >
                  {state.historyLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function WithdrawForm({
  amount,
  asset,
  balances,
  onAmountChange,
  onAssetChange,
  onSubmit,
}: {
  amount: string;
  asset: string;
  balances: Balance[];
  onAmountChange: (v: string) => void;
  onAssetChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const available = balances.find((b) => b.asset === asset)?.available;
  return (
    <div>
      <div style={s.withdrawRow}>
        <div style={{ flex: 1 }}>
          <label htmlFor="w-amount" style={s.label}>Amount</label>
          <input
            id="w-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            style={s.input}
            placeholder="0.00"
          />
        </div>
        <div style={{ width: '120px' }}>
          <label htmlFor="w-asset" style={s.label}>Asset</label>
          <select
            id="w-asset"
            value={asset}
            onChange={(e) => onAssetChange(e.target.value)}
            style={s.select}
          >
            {balances.length > 0
              ? balances.map((b) => (
                  <option key={b.asset} value={b.asset}>{b.asset}</option>
                ))
              : <option value="USDC">USDC</option>
            }
          </select>
        </div>
      </div>
      {available && (
        <p style={s.availableHint}>Available: {available} {asset}</p>
      )}
      <p style={s.withdrawNote}>
        You will be asked to sign a Stellar transaction in Freighter to confirm the withdrawal.
      </p>
      <button
        style={s.primaryBtn}
        type="button"
        onClick={onSubmit}
        disabled={!amount || Number(amount) <= 0}
      >
        Withdraw →
      </button>
    </div>
  );
}

function WithdrawProgress({ step }: { step: 'preparing' | 'signing' | 'confirming' }) {
  const messages = {
    preparing: 'Preparing withdrawal transaction…',
    signing: 'Waiting for Freighter to sign…',
    confirming: 'Confirming on-chain…',
  };
  return (
    <div style={s.statusWrap}>
      <span style={s.spinner} aria-hidden="true" />
      <p role="status">{messages[step]}</p>
    </div>
  );
}

function WithdrawSuccess({
  result,
  onReset,
}: {
  result: { txHash?: string | null; amount: string; asset: string };
  onReset: () => void;
}) {
  return (
    <div>
      <p style={s.successText}>
        ✅ Withdrew {result.amount} {result.asset} successfully.
      </p>
      {result.txHash && /^[0-9a-fA-F]{64}$/.test(result.txHash) && (
        <p style={s.txNote}>
          Transaction:{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={s.txLink}
          >
            {result.txHash.slice(0, 8)}…{result.txHash.slice(-6)}
          </a>
        </p>
      )}
      <button style={s.ghostBtn} type="button" onClick={onReset}>
        Withdraw again
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const color =
    lower === 'confirmed' || lower === 'active' ? '#34d399' :
    lower === 'pending' || lower === 'submitted' ? '#facc15' :
    lower === 'failed' ? '#f87171' :
    '#aaa';
  return <span style={{ color, fontWeight: 600, fontSize: '0.8rem' }}>{status}</span>;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#f0f0f0' },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { color: '#aaa', marginBottom: '2rem' },
  card: { background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' },
  cardHeading: { fontSize: '1.05rem', fontWeight: 600, marginBottom: '1rem' },
  authError: { background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '1.25rem', color: '#f87171' },
  errorBanner: { background: '#3b1a1a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '0.75rem 1rem', color: '#f87171', marginBottom: '1rem', fontSize: '0.875rem' },
  inlineError: { color: '#f87171', fontSize: '0.875rem' },
  emptyText: { color: '#666', fontSize: '0.875rem' },
  balanceList: { listStyle: 'none', padding: 0, display: 'flex', gap: '1rem', flexWrap: 'wrap' as const },
  balanceItem: { background: '#0d0d1a', border: '1px solid #2a2a3e', borderRadius: '10px', padding: '1rem 1.25rem', minWidth: '160px' },
  balanceAsset: { display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' },
  balanceAmounts: { display: 'flex', flexDirection: 'column' as const, gap: '0.2rem' },
  balanceAvailable: { fontSize: '1.3rem', fontWeight: 700, color: '#34d399' },
  balancePending: { fontSize: '0.8rem', color: '#facc15' },
  withdrawRow: { display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-end' },
  label: { display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.3rem' },
  input: {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #444',
    background: '#111', color: '#f0f0f0', fontSize: '0.95rem', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #444',
    background: '#111', color: '#f0f0f0', fontSize: '0.95rem', fontFamily: 'inherit',
  },
  availableHint: { fontSize: '0.75rem', color: '#34d399', marginBottom: '0.5rem' },
  withdrawNote: { fontSize: '0.8rem', color: '#888', marginBottom: '1rem' },
  primaryBtn: { padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' },
  ghostBtn: { padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'transparent', color: '#aaa', border: '1px solid #444', cursor: 'pointer', fontSize: '0.95rem' },
  statusWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '0.75rem', padding: '2rem', color: '#aaa' },
  spinner: { display: 'inline-block', width: '26px', height: '26px', border: '3px solid #333', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  successText: { color: '#34d399', marginBottom: '0.75rem' },
  txNote: { fontSize: '0.8rem', color: '#aaa', marginBottom: '0.75rem' },
  txLink: { color: '#a78bfa', textDecoration: 'none' },
  tableWrap: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' },
  th: { textAlign: 'left' as const, padding: '0.625rem 0.875rem', color: '#888', fontWeight: 600, borderBottom: '1px solid #2a2a3e' },
  tr: { borderBottom: '1px solid #1a1a2e' },
  td: { padding: '0.625rem 0.875rem', color: '#ccc' },
  tdAmount: { padding: '0.625rem 0.875rem', color: '#34d399', fontWeight: 500 },
  tdMono: { padding: '0.625rem 0.875rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#aaa' },
} as const;

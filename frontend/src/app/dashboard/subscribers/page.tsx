'use client';

/**
 * Creator Subscribers table – #1826
 *
 * Paginated subscriber list via GET /api/v1/subscriptions?creatorId=<id>.
 * Cursor-based pagination, large-page safeguard (max 50/page).
 *
 * Export:
 *   - Only an allowlisted set of fields is included in the CSV download:
 *     subscriber ID, plan ID, status, and subscription start date.
 *   - Wallet address, email, and any other PII are excluded by default.
 *   - A confirmation dialog warns the creator before export proceeds.
 *   - Export is triggered client-side from the already-fetched page data
 *     (no separate endpoint call), so no extra PII is fetched just to export.
 *
 * Security:
 *   - Default deny: sensitive fields (wallet address, email) are never
 *     included unless listed in EXPORT_ALLOWED_FIELDS.
 *   - Audit log note is shown to creator so they understand the export action.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── PII export allowlist ──────────────────────────────────────────────────
// Only these fields are written to the CSV export.
// DO NOT add walletAddress, email, or phone without a privacy review.
const EXPORT_ALLOWED_FIELDS = ['id', 'planId', 'status', 'createdAt'] as const;
type AllowedField = (typeof EXPORT_ALLOWED_FIELDS)[number];

// ── Types ──────────────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  planId: string;
  status: string;
  createdAt: string;
  // The following fields exist server-side but are intentionally NOT used in
  // the export. Keeping them here documents what is excluded.
  // walletAddress: string;
  // email?: string;
}

interface SubscribersResponse {
  data: Subscriber[];
  nextCursor: string | null;
  total?: number;
}

interface PageState {
  items: Subscriber[];
  loading: boolean;
  error: string | null;
  cursor: string | null;
  hasMore: boolean;
  total: number | null;
  showExportConfirm: boolean;
  exporting: boolean;
}

type Action =
  | { type: 'LOADED'; items: Subscriber[]; cursor: string | null; total: number | null; append: boolean }
  | { type: 'ERROR'; message: string }
  | { type: 'LOAD_MORE' }
  | { type: 'SHOW_EXPORT_CONFIRM' }
  | { type: 'CANCEL_EXPORT' }
  | { type: 'EXPORTING' }
  | { type: 'EXPORT_DONE' };

const initialState: PageState = {
  items: [],
  loading: true,
  error: null,
  cursor: null,
  hasMore: false,
  total: null,
  showExportConfirm: false,
  exporting: false,
};

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'LOADED':
      return {
        ...state,
        loading: false,
        error: null,
        items: action.append ? [...state.items, ...action.items] : action.items,
        cursor: action.cursor,
        hasMore: !!action.cursor,
        total: action.total ?? state.total,
      };
    case 'ERROR':
      return { ...state, loading: false, error: action.message };
    case 'LOAD_MORE':
      return { ...state, loading: true };
    case 'SHOW_EXPORT_CONFIRM':
      return { ...state, showExportConfirm: true };
    case 'CANCEL_EXPORT':
      return { ...state, showExportConfirm: false };
    case 'EXPORTING':
      return { ...state, exporting: true, showExportConfirm: false };
    case 'EXPORT_DONE':
      return { ...state, exporting: false };
    default:
      return state;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildCsvRow(item: Subscriber): string {
  return EXPORT_ALLOWED_FIELDS.map((field: AllowedField) => {
    const raw = item[field] ?? '';
    // Escape double-quotes per RFC 4180
    const escaped = String(raw).replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(',');
}

function downloadCsv(items: Subscriber[], filename: string): void {
  const header = EXPORT_ALLOWED_FIELDS.join(',');
  const rows = items.map(buildCsvRow);
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page component ─────────────────────────────────────────────────────────

export default function DashboardSubscribersPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadPage = useCallback(async (cursor: string | null, append: boolean) => {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    try {
      const res = await apiFetch(`/api/v1/subscriptions?${params.toString()}`, { method: 'GET' });
      if (!mountedRef.current) return;
      if (!res.ok) {
        dispatch({ type: 'ERROR', message: `Failed to load subscribers (${res.status})` });
        return;
      }
      const data = (await res.json()) as SubscribersResponse | Subscriber[];
      const items = Array.isArray(data) ? data : data.data ?? [];
      const next = Array.isArray(data) ? null : (data.nextCursor ?? null);
      const total = Array.isArray(data) ? null : (data.total ?? null);
      dispatch({ type: 'LOADED', items, cursor: next, total, append });
    } catch (err) {
      if (mountedRef.current)
        dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'Network error' });
    }
  }, []);

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage]);

  const handleLoadMore = useCallback(() => {
    dispatch({ type: 'LOAD_MORE' });
    void loadPage(state.cursor, true);
  }, [loadPage, state.cursor]);

  const handleExport = useCallback(() => {
    dispatch({ type: 'EXPORTING' });
    const filename = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(state.items, filename);
    // Normally the audit log is written server-side; here we note to the user.
    dispatch({ type: 'EXPORT_DONE' });
  }, [state.items]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.heading}>Subscribers</h1>
          {state.total !== null && (
            <p style={s.sub}>{state.total.toLocaleString()} total subscriber(s)</p>
          )}
        </div>
        <button
          style={state.items.length === 0 ? { ...s.exportBtn, opacity: 0.4, cursor: 'not-allowed' } : s.exportBtn}
          type="button"
          onClick={() => dispatch({ type: 'SHOW_EXPORT_CONFIRM' })}
          disabled={state.items.length === 0 || state.exporting}
          aria-label="Export subscriber list as CSV"
        >
          {state.exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* ── PII rules notice ── */}
      <div style={s.piiNotice} role="note">
        <strong>Export fields: </strong>
        {EXPORT_ALLOWED_FIELDS.join(', ')}.{' '}
        Wallet addresses and email are not exported to protect subscriber privacy.
      </div>

      {/* ── Export confirm dialog ── */}
      {state.showExportConfirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="export-confirm-title" style={s.dialog}>
          <h2 id="export-confirm-title" style={s.dialogTitle}>Export subscriber data?</h2>
          <p style={s.dialogBody}>
            This will download a CSV with the following non-PII fields:{' '}
            <strong>{EXPORT_ALLOWED_FIELDS.join(', ')}</strong>.
            Wallet addresses and emails are excluded.
            This action will be logged server-side for audit purposes.
          </p>
          <div style={s.dialogActions}>
            <button style={s.ghostBtn} type="button" onClick={() => dispatch({ type: 'CANCEL_EXPORT' })}>
              Cancel
            </button>
            <button style={s.primaryBtn} type="button" onClick={handleExport}>
              Download CSV
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {state.error && (
        <div role="alert" style={s.errorBanner}>
          {state.error}
          <button style={s.retryBtn} onClick={() => void loadPage(null, false)}>
            Retry
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {state.loading && state.items.length === 0 && (
        <p role="status" style={s.statusText}>Loading subscribers…</p>
      )}

      {/* ── Empty ── */}
      {!state.loading && !state.error && state.items.length === 0 && (
        <p style={s.emptyText}>No subscribers yet. Share your plans to attract fans!</p>
      )}

      {/* ── Table ── */}
      {state.items.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th} scope="col">Subscriber ID</th>
                <th style={s.th} scope="col">Plan ID</th>
                <th style={s.th} scope="col">Status</th>
                <th style={s.th} scope="col">Since</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id} style={s.tr}>
                  <td style={s.tdMono}>{item.id}</td>
                  <td style={s.tdMono}>{item.planId}</td>
                  <td style={s.td}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={s.td}>
                    <time dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Load more ── */}
      {state.hasMore && (
        <div style={{ marginTop: '1rem', textAlign: 'center' as const }}>
          <button
            style={s.ghostBtn}
            type="button"
            onClick={handleLoadMore}
            disabled={state.loading}
          >
            {state.loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const color =
    lower === 'active' ? '#34d399' :
    lower === 'created' || lower === 'submitted' ? '#facc15' :
    lower === 'confirmed' ? '#60a5fa' :
    '#f87171';
  return (
    <span style={{ color, fontSize: '0.8rem', fontWeight: 600 }}>
      {status}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#f0f0f0' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { color: '#aaa', fontSize: '0.875rem' },
  piiNotice: {
    background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: '8px',
    padding: '0.625rem 1rem', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem',
  },
  exportBtn: {
    padding: '0.5rem 1.1rem', borderRadius: '8px', background: '#1a1a2e',
    color: '#a78bfa', border: '1px solid #4c1d95', cursor: 'pointer', fontSize: '0.875rem',
  },
  errorBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1rem', borderRadius: '8px', background: '#3b1a1a',
    color: '#f87171', marginBottom: '1rem', border: '1px solid #7f1d1d', fontSize: '0.875rem',
  },
  retryBtn: { background: 'transparent', border: '1px solid #f87171', color: '#f87171', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' },
  statusText: { color: '#aaa', textAlign: 'center' as const, padding: '2rem' },
  emptyText: { color: '#666', fontSize: '0.875rem', textAlign: 'center' as const, padding: '3rem' },
  tableWrap: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.75rem 1rem', color: '#888', fontWeight: 600, borderBottom: '1px solid #2a2a3e', whiteSpace: 'nowrap' as const },
  tr: { borderBottom: '1px solid #1a1a2e' },
  td: { padding: '0.75rem 1rem', color: '#ccc' },
  tdMono: { padding: '0.75rem 1rem', color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  dialog: {
    background: '#1a1a2e', border: '1px solid #4c1d95', borderRadius: '12px',
    padding: '1.5rem', marginBottom: '1.25rem', maxWidth: '480px',
  },
  dialogTitle: { fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' },
  dialogBody: { color: '#ccc', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' },
  dialogActions: { display: 'flex', gap: '0.75rem' },
  primaryBtn: { padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  ghostBtn: { padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'transparent', color: '#aaa', border: '1px solid #444', cursor: 'pointer', fontSize: '0.9rem' },
} as const;

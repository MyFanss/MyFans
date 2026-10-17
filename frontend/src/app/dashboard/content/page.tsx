'use client';

/**
 * Dashboard Content Library – #1824
 *
 * Lists creator content via GET /api/v1/content (Posts API).
 * Upload form is shown only when the `content-upload` feature flag is enabled
 * (`NEXT_PUBLIC_FEATURE_CONTENT_UPLOAD=true`).
 *
 * Gating toggles allow the creator to mark a post as gated or public via
 * PATCH /api/v1/content/:id.
 *
 * Security: gated full content is never previewed on this page — only title,
 * teaser thumbnail and lock status are shown, regardless of the viewer's role.
 *
 * Upload failure (e.g. Pinata IPFS error) is surfaced inline with a retry
 * affordance; the item is not added to the list until the backend confirms.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── Feature flag ──────────────────────────────────────────────────────────
const UPLOAD_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_CONTENT_UPLOAD === 'true';

// ── Types ──────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  teaserUrl?: string;
  /** Never rendered on this page; kept for completeness of the type. */
  contentUrl?: string;
  isGated: boolean;
  createdAt: string;
}

interface UploadForm {
  title: string;
  description: string;
  isGated: boolean;
  file: File | null;
}

interface PageState {
  items: ContentItem[];
  itemsLoading: boolean;
  itemsError: string | null;
  /** Cursor-based pagination */
  cursor: string | null;
  hasMore: boolean;

  showUploadForm: boolean;
  upload: UploadForm;
  uploadProgress: number | null; // 0-100 or null
  uploadError: string | null;
  uploading: boolean;

  /** Per-item toggling state */
  togglingId: string | null;
  toggleError: string | null;
}

type Action =
  | { type: 'ITEMS_LOADED'; items: ContentItem[]; cursor: string | null; append: boolean }
  | { type: 'ITEMS_ERROR'; message: string }
  | { type: 'SHOW_UPLOAD' }
  | { type: 'HIDE_UPLOAD' }
  | { type: 'UPLOAD_FIELD'; field: keyof Omit<UploadForm, 'file'>; value: string | boolean }
  | { type: 'UPLOAD_FILE'; file: File | null }
  | { type: 'UPLOADING' }
  | { type: 'UPLOAD_PROGRESS'; pct: number }
  | { type: 'UPLOAD_DONE'; item: ContentItem }
  | { type: 'UPLOAD_ERROR'; message: string }
  | { type: 'TOGGLE_GATING'; id: string }
  | { type: 'TOGGLE_DONE'; id: string; isGated: boolean }
  | { type: 'TOGGLE_ERROR'; message: string };

const emptyUpload: UploadForm = {
  title: '',
  description: '',
  isGated: false,
  file: null,
};

const initialState: PageState = {
  items: [],
  itemsLoading: true,
  itemsError: null,
  cursor: null,
  hasMore: false,
  showUploadForm: false,
  upload: emptyUpload,
  uploadProgress: null,
  uploadError: null,
  uploading: false,
  togglingId: null,
  toggleError: null,
};

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'ITEMS_LOADED':
      return {
        ...state,
        itemsLoading: false,
        itemsError: null,
        items: action.append ? [...state.items, ...action.items] : action.items,
        cursor: action.cursor,
        hasMore: !!action.cursor,
      };
    case 'ITEMS_ERROR':
      return { ...state, itemsLoading: false, itemsError: action.message };
    case 'SHOW_UPLOAD':
      return { ...state, showUploadForm: true, uploadError: null };
    case 'HIDE_UPLOAD':
      return { ...state, showUploadForm: false, upload: emptyUpload, uploadProgress: null, uploadError: null };
    case 'UPLOAD_FIELD':
      return { ...state, upload: { ...state.upload, [action.field]: action.value } };
    case 'UPLOAD_FILE':
      return { ...state, upload: { ...state.upload, file: action.file } };
    case 'UPLOADING':
      return { ...state, uploading: true, uploadError: null, uploadProgress: 0 };
    case 'UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.pct };
    case 'UPLOAD_DONE':
      return {
        ...state,
        uploading: false,
        uploadProgress: null,
        uploadError: null,
        showUploadForm: false,
        upload: emptyUpload,
        items: [action.item, ...state.items],
      };
    case 'UPLOAD_ERROR':
      return { ...state, uploading: false, uploadProgress: null, uploadError: action.message };
    case 'TOGGLE_GATING':
      return { ...state, togglingId: action.id, toggleError: null };
    case 'TOGGLE_DONE':
      return {
        ...state,
        togglingId: null,
        items: state.items.map((it) =>
          it.id === action.id ? { ...it, isGated: action.isGated } : it,
        ),
      };
    case 'TOGGLE_ERROR':
      return { ...state, togglingId: null, toggleError: action.message };
    default:
      return state;
  }
}

// ── Page component ─────────────────────────────────────────────────────────

export default function DashboardContentPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadItems = useCallback(async (cursor: string | null, append: boolean) => {
    const url = cursor
      ? `/api/v1/content?cursor=${encodeURIComponent(cursor)}`
      : '/api/v1/content';
    try {
      const res = await apiFetch(url, { method: 'GET' });
      if (!mountedRef.current) return;
      if (!res.ok) {
        dispatch({ type: 'ITEMS_ERROR', message: `Failed to load content (${res.status})` });
        return;
      }
      const data = (await res.json()) as
        | ContentItem[]
        | { data: ContentItem[]; nextCursor?: string };
      const items = Array.isArray(data) ? data : data.data ?? [];
      const next = Array.isArray(data) ? null : (data.nextCursor ?? null);
      dispatch({ type: 'ITEMS_LOADED', items, cursor: next, append });
    } catch (err) {
      if (mountedRef.current)
        dispatch({ type: 'ITEMS_ERROR', message: err instanceof Error ? err.message : 'Network error' });
    }
  }, []);

  useEffect(() => {
    void loadItems(null, false);
  }, [loadItems]);

  // ── Upload ─────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!state.upload.title.trim()) return;
    dispatch({ type: 'UPLOADING' });

    try {
      const fd = new FormData();
      fd.append('title', state.upload.title.trim());
      if (state.upload.description.trim())
        fd.append('description', state.upload.description.trim());
      fd.append('isGated', String(state.upload.isGated));
      if (state.upload.file) fd.append('file', state.upload.file);

      // Use XHR for upload progress
      const result = await new Promise<ContentItem>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/content');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            dispatch({ type: 'UPLOAD_PROGRESS', pct: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText) as ContentItem);
          } else {
            const body = JSON.parse(xhr.responseText || '{}') as { message?: string };
            reject(new Error(body.message ?? `Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(fd);
      });

      if (!mountedRef.current) return;
      dispatch({ type: 'UPLOAD_DONE', item: result });
    } catch (err) {
      if (!mountedRef.current) return;
      dispatch({
        type: 'UPLOAD_ERROR',
        message: err instanceof Error ? err.message : 'Upload failed. Please retry.',
      });
    }
  }, [state.upload]);

  // ── Gating toggle ──────────────────────────────────────────────────────

  const toggleGating = useCallback(async (item: ContentItem) => {
    dispatch({ type: 'TOGGLE_GATING', id: item.id });
    const next = !item.isGated;
    try {
      const res = await apiFetch(`/api/v1/content/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isGated: next }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        dispatch({ type: 'TOGGLE_ERROR', message: `Failed to update gating (${res.status})` });
        return;
      }
      dispatch({ type: 'TOGGLE_DONE', id: item.id, isGated: next });
    } catch (err) {
      if (mountedRef.current)
        dispatch({ type: 'TOGGLE_ERROR', message: err instanceof Error ? err.message : 'Network error' });
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.heading}>Content library</h1>
          <p style={s.sub}>Manage your published posts and control gating.</p>
        </div>
        {UPLOAD_ENABLED && !state.showUploadForm && (
          <button style={s.primaryBtn} onClick={() => dispatch({ type: 'SHOW_UPLOAD' })}>
            + Upload
          </button>
        )}
        {!UPLOAD_ENABLED && (
          <span style={s.flagNote} title="Set NEXT_PUBLIC_FEATURE_CONTENT_UPLOAD=true to enable">
            Upload coming soon
          </span>
        )}
      </div>

      {/* ── Upload form (feature-flagged) ── */}
      {UPLOAD_ENABLED && state.showUploadForm && (
        <section style={s.card} aria-label="Upload content">
          <h2 style={s.cardHeading}>New upload</h2>

          {state.uploadError && (
            <div role="alert" style={s.errorBanner}>
              {state.uploadError}
              <button
                style={s.dismissBtn}
                onClick={() => dispatch({ type: 'UPLOAD_ERROR', message: '' })}
              >
                Retry
              </button>
            </div>
          )}

          <div style={s.fieldWrap}>
            <label htmlFor="c-title" style={s.label}>Title *</label>
            <input
              id="c-title"
              type="text"
              value={state.upload.title}
              onChange={(e) => dispatch({ type: 'UPLOAD_FIELD', field: 'title', value: e.target.value })}
              style={s.input}
              placeholder="Post title"
              disabled={state.uploading}
            />
          </div>

          <div style={s.fieldWrap}>
            <label htmlFor="c-desc" style={s.label}>Description</label>
            <textarea
              id="c-desc"
              value={state.upload.description}
              onChange={(e) => dispatch({ type: 'UPLOAD_FIELD', field: 'description', value: e.target.value })}
              style={{ ...s.input, minHeight: '80px', resize: 'vertical' }}
              placeholder="Optional description…"
              disabled={state.uploading}
              rows={3}
            />
          </div>

          <div style={s.fieldWrap}>
            <label style={s.label}>File</label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => dispatch({ type: 'UPLOAD_FILE', file: e.target.files?.[0] ?? null })}
              disabled={state.uploading}
              style={{ color: '#ccc' }}
            />
          </div>

          <div style={s.checkWrap}>
            <input
              id="c-gated"
              type="checkbox"
              checked={state.upload.isGated}
              onChange={(e) => dispatch({ type: 'UPLOAD_FIELD', field: 'isGated', value: e.target.checked })}
              disabled={state.uploading}
            />
            <label htmlFor="c-gated" style={s.checkLabel}>
              Gated (subscribers only)
            </label>
          </div>

          {state.uploadProgress !== null && (
            <div style={s.progressWrap} role="progressbar" aria-valuenow={state.uploadProgress} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ ...s.progressBar, width: `${state.uploadProgress}%` }} />
              <span style={s.progressLabel}>{state.uploadProgress}%</span>
            </div>
          )}

          <div style={s.formActions}>
            <button
              style={s.ghostBtn}
              type="button"
              onClick={() => dispatch({ type: 'HIDE_UPLOAD' })}
              disabled={state.uploading}
            >
              Cancel
            </button>
            <button
              style={s.primaryBtn}
              type="button"
              onClick={() => void handleUpload()}
              disabled={state.uploading || !state.upload.title.trim()}
            >
              {state.uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </section>
      )}

      {/* ── Toggle error ── */}
      {state.toggleError && (
        <div role="alert" style={s.errorBanner}>
          {state.toggleError}
        </div>
      )}

      {/* ── Content list ── */}
      {state.itemsLoading && <p role="status" style={{ color: '#aaa' }}>Loading content…</p>}

      {state.itemsError && (
        <div role="alert" style={s.errorBanner}>
          {state.itemsError}
          <button style={s.dismissBtn} onClick={() => void loadItems(null, false)}>
            Retry
          </button>
        </div>
      )}

      {!state.itemsLoading && !state.itemsError && state.items.length === 0 && (
        <p style={s.emptyText}>No content yet. {UPLOAD_ENABLED ? 'Upload your first post.' : ''}</p>
      )}

      {state.items.length > 0 && (
        <ul style={s.list} aria-label="Content items">
          {state.items.map((item) => (
            <li key={item.id} style={s.listItem}>
              {/* Teaser thumbnail — never the full contentUrl */}
              {item.teaserUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.teaserUrl}
                  alt="Teaser"
                  style={s.thumb}
                  aria-hidden="true"
                />
              )}
              {!item.teaserUrl && <div style={s.thumbPlaceholder} aria-hidden="true" />}

              <div style={s.itemBody}>
                <strong style={s.itemTitle}>{item.title}</strong>
                {item.description && <p style={s.itemDesc}>{item.description}</p>}
                <time style={s.itemDate} dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </time>
              </div>

              <div style={s.itemActions}>
                <span style={item.isGated ? s.tagGated : s.tagPublic}>
                  {item.isGated ? '🔒 Gated' : '🌐 Public'}
                </span>
                <button
                  style={s.toggleBtn}
                  type="button"
                  onClick={() => void toggleGating(item)}
                  disabled={state.togglingId === item.id}
                  aria-label={item.isGated ? 'Make public' : 'Make gated'}
                >
                  {state.togglingId === item.id ? '…' : item.isGated ? 'Make public' : 'Make gated'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {state.hasMore && (
        <button
          style={{ ...s.ghostBtn, marginTop: '1rem' }}
          type="button"
          onClick={() => void loadItems(state.cursor, true)}
        >
          Load more
        </button>
      )}
    </main>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif', color: '#f0f0f0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' },
  sub: { color: '#aaa' },
  flagNote: { fontSize: '0.8rem', color: '#555', border: '1px solid #333', borderRadius: '6px', padding: '0.35rem 0.75rem' },
  card: { background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' },
  cardHeading: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' },
  fieldWrap: { marginBottom: '0.875rem' },
  label: { display: 'block', fontSize: '0.875rem', marginBottom: '0.3rem', color: '#ccc' },
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
  checkWrap: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' },
  checkLabel: { color: '#ccc', fontSize: '0.875rem', cursor: 'pointer' },
  progressWrap: {
    background: '#111',
    borderRadius: '4px',
    height: '8px',
    overflow: 'hidden',
    marginBottom: '1rem',
    position: 'relative' as const,
  },
  progressBar: { background: '#7c3aed', height: '100%', transition: 'width 0.2s' },
  progressLabel: { position: 'absolute' as const, right: '0.5rem', top: '-1.25rem', fontSize: '0.75rem', color: '#aaa' },
  formActions: { display: 'flex', gap: '0.75rem' },
  errorBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1rem', borderRadius: '8px', background: '#3b1a1a',
    color: '#f87171', marginBottom: '1rem', border: '1px solid #7f1d1d', fontSize: '0.875rem',
  },
  dismissBtn: {
    background: 'transparent', border: '1px solid #f87171', color: '#f87171',
    borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem',
  },
  primaryBtn: {
    padding: '0.6rem 1.4rem', borderRadius: '8px', background: '#7c3aed',
    color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
  },
  ghostBtn: {
    padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'transparent',
    color: '#aaa', border: '1px solid #444', cursor: 'pointer', fontSize: '0.95rem',
  },
  list: { listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  listItem: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '10px', padding: '0.875rem',
  },
  thumb: { width: '64px', height: '64px', objectFit: 'cover' as const, borderRadius: '6px', flexShrink: 0 },
  thumbPlaceholder: { width: '64px', height: '64px', borderRadius: '6px', background: '#111', flexShrink: 0 },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { display: 'block', fontSize: '0.95rem' },
  itemDesc: { color: '#888', fontSize: '0.8rem', margin: '0.2rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  itemDate: { fontSize: '0.75rem', color: '#555' },
  itemActions: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 },
  tagGated: { fontSize: '0.75rem', color: '#f59e0b', background: '#1c1805', borderRadius: '4px', padding: '0.15rem 0.4rem', border: '1px solid #713f12' },
  tagPublic: { fontSize: '0.75rem', color: '#34d399', background: '#052016', borderRadius: '4px', padding: '0.15rem 0.4rem', border: '1px solid #064e3b' },
  toggleBtn: {
    fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
    background: 'transparent', border: '1px solid #444', color: '#aaa', cursor: 'pointer',
  },
  emptyText: { color: '#666', fontSize: '0.875rem' },
} as const;

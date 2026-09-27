'use client';

import { useEffect, useReducer, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

type AuthState = 'loading' | 'unauth' | 'ready';

interface FavoritesState {
  auth: AuthState;
  ids: string[];
  error: string | null;
  /** Set of creator IDs currently undergoing an optimistic toggle. */
  pending: Set<string>;
}

type Action =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_UNAUTH' }
  | { type: 'LOAD_SUCCESS'; ids: string[] }
  | { type: 'LOAD_ERROR'; message: string }
  | { type: 'TOGGLE_OPTIMISTIC'; id: string }
  | { type: 'TOGGLE_COMMIT'; id: string }
  | { type: 'TOGGLE_ROLLBACK'; id: string; restore: boolean };

function reducer(state: FavoritesState, action: Action): FavoritesState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, auth: 'loading', error: null };
    case 'LOAD_UNAUTH':
      return { ...state, auth: 'unauth', ids: [], error: null };
    case 'LOAD_SUCCESS':
      return { ...state, auth: 'ready', ids: action.ids, error: null };
    case 'LOAD_ERROR':
      return { ...state, auth: 'ready', error: action.message };
    case 'TOGGLE_OPTIMISTIC': {
      const hadIt = state.ids.includes(action.id);
      const next = hadIt ? state.ids.filter((i) => i !== action.id) : [...state.ids, action.id];
      const pending = new Set(state.pending);
      pending.add(action.id);
      return { ...state, ids: next, pending };
    }
    case 'TOGGLE_COMMIT': {
      const pending = new Set(state.pending);
      pending.delete(action.id);
      return { ...state, pending };
    }
    case 'TOGGLE_ROLLBACK': {
      const pending = new Set(state.pending);
      pending.delete(action.id);
      const ids = action.restore
        ? state.ids.includes(action.id)
          ? state.ids
          : [...state.ids, action.id]
        : state.ids.filter((i) => i !== action.id);
      return { ...state, ids, pending, error: 'Failed to update favorite. Please try again.' };
    }
    default:
      return state;
  }
}

const initialState: FavoritesState = {
  auth: 'loading',
  ids: [],
  error: null,
  pending: new Set(),
};

// ── Page component ────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load favorites on mount
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'LOAD_START' });

    apiFetch('/api/v1/favorites', { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          dispatch({ type: 'LOAD_UNAUTH' });
          return;
        }
        if (!res.ok) {
          const msg = `Error loading favorites (${res.status})`;
          dispatch({ type: 'LOAD_ERROR', message: msg });
          return;
        }
        const data = (await res.json()) as string[];
        dispatch({ type: 'LOAD_SUCCESS', ids: Array.isArray(data) ? data : [] });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'LOAD_ERROR', message: 'Network error. Please try again.' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      const wasFavorited = state.ids.includes(id);
      dispatch({ type: 'TOGGLE_OPTIMISTIC', id });

      try {
        const res = await apiFetch(`/api/v1/favorites/${id}`, {
          method: wasFavorited ? 'DELETE' : 'POST',
        });

        if (!res.ok) {
          // Rollback: restore previous state
          dispatch({ type: 'TOGGLE_ROLLBACK', id, restore: wasFavorited });
          return;
        }
        dispatch({ type: 'TOGGLE_COMMIT', id });
      } catch {
        dispatch({ type: 'TOGGLE_ROLLBACK', id, restore: wasFavorited });
      }
    },
    [state.ids],
  );

  // ── Render states ─────────────────────────────────────────────────────

  if (state.auth === 'loading') {
    return (
      <main style={styles.page}>
        <p role="status">Loading…</p>
      </main>
    );
  }

  if (state.auth === 'unauth') {
    return (
      <main style={styles.page}>
        <h1 style={styles.heading}>Favorites</h1>
        <p>Sign in to save and view your favorite creators</p>
        <Link href="/auth/sign-in" style={styles.ctaLink}>
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Favorites</h1>

      {state.error && (
        <p role="alert" style={styles.error}>
          {state.error}
        </p>
      )}

      {state.ids.length === 0 ? (
        <div style={styles.empty}>
          <p>{"You haven't marked any creators as favorites yet"}</p>
          <Link href="/discover" style={styles.ctaLink}>
            Discover Creators
          </Link>
        </div>
      ) : (
        <>
          <p style={styles.count}>You have {state.ids.length} favorite creator{state.ids.length !== 1 ? 's' : ''}</p>
          <ul style={styles.list}>
            {state.ids.map((id) => (
              <li key={id} style={styles.item}>
                <span style={styles.creatorId}>{id}</span>
                <button
                  onClick={() => toggle(id)}
                  disabled={state.pending.has(id)}
                  aria-label={`Remove ${id} from favorites`}
                  style={styles.removeBtn}
                >
                  {state.pending.has(id) ? '…' : '♥ Remove'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

// ── Inline styles (no external CSS dependency) ────────────────────────────

const styles = {
  page: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '1.5rem',
  },
  count: {
    marginBottom: '1rem',
    color: '#aaa',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.875rem 1rem',
    borderRadius: '8px',
    background: '#1a1a1a',
    border: '1px solid #333',
  },
  creatorId: {
    fontWeight: 500,
  },
  removeBtn: {
    padding: '0.4rem 0.875rem',
    borderRadius: '6px',
    border: '1px solid #555',
    background: 'transparent',
    color: '#f0f0f0',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    alignItems: 'flex-start',
    color: '#aaa',
  },
  ctaLink: {
    display: 'inline-block',
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 600,
    textDecoration: 'none',
  },
  error: {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    background: '#3b1a1a',
    color: '#f87171',
    marginBottom: '1rem',
    border: '1px solid #7f1d1d',
  },
} as const;

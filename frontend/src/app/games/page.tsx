'use client';

import { useEffect, useReducer, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

type GameStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface Game {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  status: GameStatus;
  maxPlayers: number;
  currentPlayers: number;
  hostUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface GameListResponse {
  data: Game[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Toast ─────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

// ── State machine ─────────────────────────────────────────────────────────

type PageStatus =
  | 'loading'
  | 'unauth'
  | 'server_error'
  | 'ready'
  | 'detail_loading'
  | 'detail';

interface PageState {
  status: PageStatus;
  games: Game[];
  activeGame: Game | null;
  mutating: string | null; // game ID currently being mutated
  toasts: Toast[];
  _toastSeq: number;
}

type Action =
  | { type: 'LOAD_UNAUTH' }
  | { type: 'LOAD_SERVER_ERROR' }
  | { type: 'LOAD_SUCCESS'; games: Game[] }
  | { type: 'SELECT_GAME'; id: string }
  | { type: 'DETAIL_LOADED'; game: Game }
  | { type: 'DETAIL_ERROR' }
  | { type: 'MUTATE_START'; id: string }
  | { type: 'MUTATE_SUCCESS'; game: Game; message: string }
  | { type: 'MUTATE_ERROR'; message: string }
  | { type: 'DISMISS_TOAST'; id: number };

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'LOAD_UNAUTH':
      return { ...state, status: 'unauth' };
    case 'LOAD_SERVER_ERROR':
      return { ...state, status: 'server_error' };
    case 'LOAD_SUCCESS':
      return { ...state, status: 'ready', games: action.games };
    case 'SELECT_GAME':
      return { ...state, status: 'detail_loading', activeGame: null };
    case 'DETAIL_LOADED':
      return { ...state, status: 'detail', activeGame: action.game };
    case 'DETAIL_ERROR':
      return { ...state, status: 'ready', activeGame: null };
    case 'MUTATE_START':
      return { ...state, mutating: action.id };
    case 'MUTATE_SUCCESS': {
      const seq = state._toastSeq + 1;
      const toast: Toast = { id: seq, message: action.message, type: 'success' };
      const games = state.games.map((g) => (g.id === action.game.id ? action.game : g));
      const activeGame =
        state.activeGame?.id === action.game.id ? action.game : state.activeGame;
      return {
        ...state,
        mutating: null,
        games,
        activeGame,
        toasts: [...state.toasts, toast],
        _toastSeq: seq,
      };
    }
    case 'MUTATE_ERROR': {
      const seq = state._toastSeq + 1;
      const toast: Toast = { id: seq, message: action.message, type: 'error' };
      return { ...state, mutating: null, toasts: [...state.toasts, toast], _toastSeq: seq };
    }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

const initialState: PageState = {
  status: 'loading',
  games: [],
  activeGame: null,
  mutating: null,
  toasts: [],
  _toastSeq: 0,
};

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function GamesPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/api/v1/games', { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          dispatch({ type: 'LOAD_UNAUTH' });
          return;
        }
        if (!res.ok) {
          dispatch({ type: 'LOAD_SERVER_ERROR' });
          return;
        }
        const data = (await res.json()) as GameListResponse;
        dispatch({ type: 'LOAD_SUCCESS', games: data.data ?? [] });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'LOAD_SERVER_ERROR' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectGame = useCallback(async (id: string) => {
    dispatch({ type: 'SELECT_GAME', id });
    try {
      const res = await apiFetch(`/api/v1/games/${id}`, { method: 'GET' });
      if (!res.ok) {
        dispatch({ type: 'DETAIL_ERROR' });
        return;
      }
      const game = (await res.json()) as Game;
      dispatch({ type: 'DETAIL_LOADED', game });
    } catch {
      dispatch({ type: 'DETAIL_ERROR' });
    }
  }, []);

  const joinGame = useCallback(
    async (id: string) => {
      dispatch({ type: 'MUTATE_START', id });
      try {
        const res = await apiFetch(`/api/v1/games/${id}/join`, {
          method: 'POST',
          idempotencyKey: generateIdempotencyKey(),
        });
        if (!res.ok) {
          dispatch({ type: 'MUTATE_ERROR', message: 'Failed to join game. Please try again.' });
          return;
        }
        // Reload detail so player count is fresh
        const detailRes = await apiFetch(`/api/v1/games/${id}`, { method: 'GET' });
        if (detailRes.ok) {
          const game = (await detailRes.json()) as Game;
          dispatch({ type: 'MUTATE_SUCCESS', game, message: 'Successfully joined the game' });
        } else {
          dispatch({ type: 'MUTATE_ERROR', message: 'Failed to refresh game after joining.' });
        }
      } catch {
        dispatch({ type: 'MUTATE_ERROR', message: 'Network error. Could not join game.' });
      }
    },
    [],
  );

  const startGame = useCallback(
    async (id: string) => {
      dispatch({ type: 'MUTATE_START', id });
      try {
        const res = await apiFetch(`/api/v1/games/${id}/start`, {
          method: 'POST',
          idempotencyKey: generateIdempotencyKey(),
        });
        if (!res.ok) {
          dispatch({ type: 'MUTATE_ERROR', message: 'Failed to start game. Please try again.' });
          return;
        }
        const game = (await res.json()) as Game;
        dispatch({ type: 'MUTATE_SUCCESS', game, message: 'Game started!' });
      } catch {
        dispatch({ type: 'MUTATE_ERROR', message: 'Network error. Could not start game.' });
      }
    },
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Games</h1>

      {/* Toast region */}
      <div style={styles.toastRegion} aria-live="polite">
        {state.toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              ...styles.toast,
              ...(t.type === 'error' ? styles.toastError : styles.toastSuccess),
            }}
          >
            <span>{t.message}</span>
            <button
              style={styles.toastClose}
              onClick={() => dispatch({ type: 'DISMISS_TOAST', id: t.id })}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {state.status === 'loading' && <p role="status">Loading games…</p>}

      {state.status === 'unauth' && (
        <p role="alert">
          You must be signed in to view games. Please sign in to continue.
        </p>
      )}

      {state.status === 'server_error' && (
        <p role="alert">
          We encountered an issue loading games. Please try again later.
        </p>
      )}

      {(state.status === 'ready' ||
        state.status === 'detail_loading' ||
        state.status === 'detail') && (
        <div style={styles.layout}>
          {/* Sidebar: game list */}
          <aside style={styles.sidebar}>
            {state.games.length === 0 && (
              <p style={styles.emptyText}>No games available right now.</p>
            )}
            <ul style={styles.gameList}>
              {state.games.map((game) => (
                <li key={game.id}>
                  <button
                    style={{
                      ...styles.gameBtn,
                      ...(state.activeGame?.id === game.id ? styles.gameBtnActive : {}),
                    }}
                    onClick={() => selectGame(game.id)}
                  >
                    <span style={styles.gameTitle}>{game.title}</span>
                    <span style={styles.gameMeta}>
                      {game.currentPlayers}/{game.maxPlayers} players · {game.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Detail panel */}
          <section style={styles.detail} aria-label="Game detail">
            {state.status === 'detail_loading' && (
              <p role="status">Loading game…</p>
            )}
            {state.status === 'ready' && !state.activeGame && (
              <p style={styles.emptyText}>Select a game to see details.</p>
            )}
            {state.status === 'detail' && state.activeGame && (
              <GameDetail
                game={state.activeGame}
                mutating={state.mutating === state.activeGame.id}
                onJoin={() => joinGame(state.activeGame!.id)}
                onStart={() => startGame(state.activeGame!.id)}
              />
            )}
          </section>
        </div>
      )}
    </main>
  );
}

// ── GameDetail sub-component ──────────────────────────────────────────────

function GameDetail({
  game,
  mutating,
  onJoin,
  onStart,
}: {
  game: Game;
  mutating: boolean;
  onJoin: () => void;
  onStart: () => void;
}) {
  const isFull = game.currentPlayers >= game.maxPlayers;

  return (
    <div>
      <h2 style={styles.detailHeading}>{game.title}</h2>
      <p style={styles.detailDesc}>{game.description}</p>
      <p style={styles.detailMeta}>
        Players:{' '}
        <strong>
          {game.currentPlayers}/{game.maxPlayers}
        </strong>
      </p>
      <p style={styles.detailMeta}>
        Status: <strong>{game.status}</strong>
      </p>

      <div style={styles.actions}>
        {game.status === 'PENDING' && !isFull && (
          <button
            style={styles.actionBtn}
            onClick={onJoin}
            disabled={mutating}
            aria-label="Join Game"
          >
            {mutating ? 'Joining…' : 'Join Game'}
          </button>
        )}
        {game.status === 'PENDING' && (
          <button
            style={{ ...styles.actionBtn, ...styles.actionBtnSecondary }}
            onClick={onStart}
            disabled={mutating}
            aria-label="Start Game"
          >
            {mutating ? 'Starting…' : 'Start Game'}
          </button>
        )}
        {game.status === 'ACTIVE' && (
          <span style={styles.badge}>Game in progress</span>
        )}
        {(game.status === 'COMPLETED' || game.status === 'CANCELLED') && (
          <span style={styles.badge}>
            {game.status === 'COMPLETED' ? 'Game completed' : 'Game cancelled'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = {
  page: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' },
  layout: { display: 'flex', gap: '1rem', marginTop: '1rem' },
  sidebar: {
    width: '260px',
    flexShrink: 0,
    borderRight: '1px solid #333',
    paddingRight: '1rem',
  },
  gameList: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  gameBtn: {
    width: '100%',
    textAlign: 'left' as const,
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    color: '#f0f0f0',
  },
  gameBtnActive: { background: '#1e1e2e' },
  gameTitle: { fontWeight: 600, fontSize: '0.95rem' },
  gameMeta: { fontSize: '0.8rem', color: '#888' },
  detail: { flex: 1, padding: '0 0.5rem' },
  detailHeading: { fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' },
  detailDesc: { color: '#aaa', marginBottom: '1rem' },
  detailMeta: { marginBottom: '0.4rem' },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.5rem',
    flexWrap: 'wrap' as const,
  },
  actionBtn: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnSecondary: { background: '#1e40af' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.4rem 0.875rem',
    borderRadius: '20px',
    background: '#1a2a1a',
    color: '#6ee7b7',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: '1px solid #166534',
  },
  emptyText: { color: '#888', fontSize: '0.9rem' },
  toastRegion: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    zIndex: 100,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    minWidth: '240px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  toastSuccess: { background: '#14532d', border: '1px solid #166534', color: '#d1fae5' },
  toastError: { background: '#3b1a1a', border: '1px solid #7f1d1d', color: '#fca5a5' },
  toastClose: {
    marginLeft: 'auto',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '1.1rem',
  },
} as const;

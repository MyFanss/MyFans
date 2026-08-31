/**
 * Games API client.
 */
import { getApiBaseUrl } from '@/lib/api/base-url';

export interface Game {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  maxPlayers: number;
  currentPlayers: number;
  hostUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GamesPage {
  data: Game[];
  limit: number;
  nextCursor?: string | null;
  hasMore: boolean;
}

const API_BASE = `${getApiBaseUrl()}/api/v1`;

/**
 * List games with optional filtering and pagination.
 */
export async function listGames(params: {
  page?: number;
  limit?: number;
  status?: string;
  cursor?: string;
} = {}): Promise<GamesPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.cursor) qs.set('cursor', params.cursor);

  const res = await fetch(`${API_BASE}/games?${qs.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<GamesPage>;
}

/**
 * Get a single game by ID.
 * Returns null when game is not found.
 */
export async function getGameById(id: string): Promise<Game | null> {
  const res = await fetch(`${API_BASE}/games/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<Game>;
}

/**
 * Join a game as the authenticated user.
 */
export async function joinGame(gameId: string, csrfToken?: string): Promise<{ success: boolean; message?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const res = await fetch(`${API_BASE}/games/${encodeURIComponent(gameId)}/join`, {
    method: 'POST',
    credentials: 'include',
    headers,
  });
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  if (res.status === 404) {
    throw new Error('Game not found');
  }
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Already joined this game');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<{ success: boolean; message?: string }>;
}

/**
 * Start a game (host-only action).
 */
export async function startGame(
  gameId: string,
  params: {
    idempotencyKey?: string;
  } = {},
  csrfToken?: string,
): Promise<Game> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  if (params.idempotencyKey) {
    headers['idempotency-key'] = params.idempotencyKey;
  }

  const res = await fetch(`${API_BASE}/games/${encodeURIComponent(gameId)}/start`, {
    method: 'POST',
    credentials: 'include',
    headers,
  });
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  if (res.status === 403) {
    throw new Error('Only the host can start the game');
  }
  if (res.status === 404) {
    throw new Error('Game not found');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<Game>;
}

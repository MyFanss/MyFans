const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type FavoritesPayload =
  | string[]
  | {
      favorites?: string[];
      data?: string[];
    };

function extractFavorites(payload: FavoritesPayload): string[] {
  if (Array.isArray(payload)) {
    return [...new Set(payload.filter((value): value is string => typeof value === 'string'))];
  }

  const favorites = payload.favorites ?? payload.data ?? [];
  return [...new Set(favorites.filter((value): value is string => typeof value === 'string'))];
}

async function requestFavorites<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const fallbackMessage = `Favorites request failed with status ${response.status}`;
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === 'object' && 'message' in errorBody && typeof errorBody.message === 'string'
        ? errorBody.message
        : fallbackMessage;

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getFavorites(): Promise<string[]> {
  const payload = await requestFavorites<FavoritesPayload>('/favorites');
  return extractFavorites(payload);
}

export async function addFavorite(creatorId: string): Promise<void> {
  await requestFavorites(`/favorites/${encodeURIComponent(creatorId)}`, {
    method: 'POST',
  });
}

export async function removeFavorite(creatorId: string): Promise<void> {
  await requestFavorites(`/favorites/${encodeURIComponent(creatorId)}`, {
    method: 'DELETE',
  });
}

/**
 * Creators search API client.
 */

export interface PublicCreator {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export interface CreatorsSearchResult {
  data: PublicCreator[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function searchCreators(params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<CreatorsSearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/creators?${qs.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<CreatorsSearchResult>;
}

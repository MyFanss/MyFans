import type { PublicPost } from './posts';
import { getApiBaseUrl } from './base-url';

const API_BASE = `${getApiBaseUrl()}/api/v1`;

export interface FeedPage {
  data: PublicPost[];
  cursor: string | null;
  nextCursor: string | null;
  total: number;
  hasMore: boolean;
}

export async function getFeed(params: {
  cursor?: string;
  limit?: number;
} = {}): Promise<FeedPage> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(
    `${API_BASE}/feed/subscriptions?${qs.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Request failed: ${res.status}`,
    );
  }

  return res.json() as Promise<FeedPage>;
}

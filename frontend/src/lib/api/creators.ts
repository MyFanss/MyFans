/**
 * Creators search API client.
 */
import type { CreatorProfile } from '@/lib/creator-profile';
import { getApiBaseUrl } from '@/lib/api/base-url';

export interface PublicCreator {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  followers_count: number;
  /** Present on `/creators` and `/creators/username/:username` when the creator has set a price. */
  subscription_price?: string | number | null;
  currency?: string | null;
  categories?: string[] | null;
}

export interface CreatorsSearchResult {
  data: PublicCreator[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

const API_BASE = `${getApiBaseUrl()}/api/v1`;

export async function searchCreators(params: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<CreatorsSearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.cursor) qs.set('cursor', params.cursor);
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

/**
 * Fetch a single public creator profile by exact username.
 * Returns null when no creator matches (caller should 404).
 */
export async function getCreatorProfile(username: string): Promise<PublicCreator | null> {
  const res = await fetch(`${API_BASE}/creators/username/${encodeURIComponent(username)}`, {
    credentials: 'include',
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<PublicCreator>;
}

/**
 * Parse the API's `subscription_price` field into a number.
 *
 * The field can arrive as a numeric string (Postgres `numeric` columns are
 * serialized as strings), a plain number, null, or be absent entirely.
 * Anything that doesn't parse to a finite number falls back to 0 rather
 * than propagating `NaN` into price displays and sort comparisons.
 */
function parseSubscriptionPrice(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Map an API creator record to the CreatorProfile shape used by the
 * discovery grid and the profile page's hero/header components.
 *
 * The backend doesn't track location or social links for a creator yet,
 * so those fall back to sensible empty defaults rather than fabricated
 * data. Subscriber count, subscription price, and categories are mapped
 * from the API when present, and default safely when absent.
 */
export function publicCreatorToProfile(c: PublicCreator): CreatorProfile {
  return {
    id: c.id,
    username: c.username,
    displayName: c.display_name,
    bio: c.bio ?? '',
    avatarUrl: c.avatar_url ?? undefined,
    subscriberCount: c.followers_count ?? 0,
    subscriptionPrice: parseSubscriptionPrice(c.subscription_price),
    isVerified: c.is_verified,
    categories: c.categories ?? [],
    socialLinks: [],
  };
}

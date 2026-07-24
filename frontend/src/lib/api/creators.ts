/**
 * Creators search API client.
 */
import type { CreatorProfile } from '@/lib/creator-profile';

export interface PublicCreator {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  followers_count: number;
}

export interface CreatorsSearchResult {
  data: PublicCreator[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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
 * Map an API creator record to the CreatorProfile shape used by the
 * discovery grid and the profile page's hero/header components.
 *
 * The backend doesn't yet track subscriber count, subscription price,
 * categories, location, or social links for a creator, so those fall
 * back to sensible empty defaults rather than fabricated data.
 */
export function publicCreatorToProfile(c: PublicCreator): CreatorProfile {
  return {
    id: c.id,
    username: c.username,
    displayName: c.display_name,
    bio: c.bio ?? '',
    avatarUrl: c.avatar_url ?? undefined,
    subscriberCount: c.followers_count,
    subscriptionPrice: 0,
    isVerified: c.is_verified,
    categories: [],
    socialLinks: [],
  };
}

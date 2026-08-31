/**
 * Content API client.
 */
import { getApiBaseUrl } from '@/lib/api/base-url';

export interface ContentMetadata {
  id: string;
  title: string;
  description: string;
  contentUrl: string;
  thumbnailUrl?: string;
  type: 'video' | 'image' | 'audio' | 'text';
  isGated: boolean;
  /**
   * Server-authoritative lock flag. When present it is the source of truth
   * for whether the current viewer may see the full asset; `isGated` only
   * says the content *can* be gated. Callers should treat
   * `locked === true` (or `isGated && !hasAccess`) as locked.
   */
  locked?: boolean;
  /** Server-evaluated access for the current viewer, when the detail
   * endpoint returns it inline (saves a follow-up `/access` round trip). */
  hasAccess?: boolean;
  creator: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
    isVerified: boolean;
  };
  metadata: {
    publishedAt: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    duration?: string;
    tags: string[];
  };
  relatedContent?: Array<{
    id: string;
    title: string;
    thumbnailUrl?: string;
    type: 'video' | 'image' | 'audio' | 'text';
  }>;
}

export type ContentAccessReason =
  | 'granted'
  | 'not_authenticated'
  | 'subscription_required'
  | 'purchase_required'
  | 'not_found'
  | 'error';

export interface ContentAccess {
  hasAccess: boolean;
  reason: ContentAccessReason;
}

const API_BASE = `${getApiBaseUrl()}/api/v1`;

/**
 * Fetch content by ID.
 * Returns null when content is not found (caller should 404).
 */
export async function getContentById(id: string): Promise<ContentMetadata | null> {
  const res = await fetch(`${API_BASE}/content/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<ContentMetadata>;
}

/**
 * Ask the backend whether the current viewer may unlock this content.
 *
 * This replaces the old client-side "unlock" mock (a `setTimeout` plus a
 * localStorage subscription flag): access is now decided by
 * `GET /v1/content/:id/access`, honoring the server's view of the viewer's
 * subscription / purchase state.
 *
 * Fails **closed** — any network or server error resolves to
 * `{ hasAccess: false }` so a transient failure can never expose gated
 * media (IPFS URL, full asset) to a viewer who has not been granted access.
 */
export async function getContentAccess(id: string): Promise<ContentAccess> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/content/${encodeURIComponent(id)}/access`, {
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    return { hasAccess: false, reason: 'error' };
  }

  if (res.status === 404) {
    return { hasAccess: false, reason: 'not_found' };
  }
  if (res.status === 401) {
    return { hasAccess: false, reason: 'not_authenticated' };
  }
  if (!res.ok) {
    return { hasAccess: false, reason: 'error' };
  }

  const data = (await res.json().catch(() => ({}))) as {
    hasAccess?: boolean;
    unlocked?: boolean;
    granted?: boolean;
    reason?: ContentAccessReason;
  };

  const hasAccess = Boolean(data.hasAccess ?? data.unlocked ?? data.granted);
  return {
    hasAccess,
    reason: data.reason ?? (hasAccess ? 'granted' : 'subscription_required'),
  };
}

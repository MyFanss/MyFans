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

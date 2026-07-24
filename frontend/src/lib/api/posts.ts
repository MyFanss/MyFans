/**
 * Posts API client.
 */
import type { CreatorPost } from '@/lib/creator-profile';

const EXCERPT_LENGTH = 140;

export interface PublicPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  isPublished: boolean;
  isPremium: boolean;
  likesCount: number;
  createdAt: string;
}

export interface PostsPage {
  data: PublicPost[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function getPostsByAuthor(
  authorId: string,
  params: { page?: number; limit?: number } = {},
): Promise<PostsPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/posts/author/${encodeURIComponent(authorId)}?${qs.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<PostsPage>;
}

/**
 * Map an API post to the CreatorPost shape used by ContentCard.
 *
 * `GET /posts/author/:authorId` doesn't filter on isPublished (it's shared
 * with the author's own dashboard, which needs to see drafts), so callers
 * displaying posts on a public profile must filter for isPublished
 * themselves — see getPublishedPostsByAuthor below.
 *
 * The backend doesn't track media type, thumbnails, or view counts yet, so
 * those fall back to sensible defaults rather than fabricated data.
 */
export function publicPostToCreatorPost(post: PublicPost): CreatorPost {
  return {
    id: post.id,
    title: post.title,
    type: 'text',
    excerpt:
      post.content.length > EXCERPT_LENGTH
        ? `${post.content.slice(0, EXCERPT_LENGTH).trimEnd()}…`
        : post.content,
    publishedAt: post.createdAt,
    isLocked: post.isPremium,
    likeCount: post.likesCount,
  };
}

/**
 * Fetch a page of a creator's posts and filter to published ones only,
 * mapped to the CreatorPost shape for public display.
 */
export async function getPublishedPostsByAuthor(
  authorId: string,
  params: { page?: number; limit?: number } = {},
): Promise<CreatorPost[]> {
  const page = await getPostsByAuthor(authorId, params);
  return page.data.filter((post) => post.isPublished).map(publicPostToCreatorPost);
}

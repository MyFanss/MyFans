import { getApiBaseUrl } from '@/lib/api/base-url';

const API_BASE = `${getApiBaseUrl()}/api/v1`;

export interface LikeToggleResult {
  liked: boolean;
  count: number;
}

async function parseLikeResponse<T>(res: Response): Promise<T> {
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Unauthorized');
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const message = typeof payload?.message === 'string' ? payload.message : `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return (await res.json().catch(() => ({}))) as T;
}

export async function getPostLikeStatus(postId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/like/status`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 401 || res.status === 403) {
    return false;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(typeof payload?.message === 'string' ? payload.message : `Request failed: ${res.status}`);
  }

  const payload = (await res.json().catch(() => ({}))) as { liked?: boolean };
  return Boolean(payload.liked);
}

export async function getPostLikeCount(postId: string): Promise<number> {
  const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/likes/count`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(typeof payload?.message === 'string' ? payload.message : `Request failed: ${res.status}`);
  }

  const payload = (await res.json().catch(() => ({}))) as { count?: number };
  return Number(payload.count ?? 0);
}

export async function togglePostLike(postId: string, liked: boolean): Promise<LikeToggleResult> {
  const method = liked ? 'POST' : 'DELETE';
  const url = `${API_BASE}/posts/${encodeURIComponent(postId)}/like`;

  const res = await fetch(url, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 204) {
    const count = await getPostLikeCount(postId);
    return { liked: false, count };
  }

  const payload = await parseLikeResponse<{ liked?: boolean; count?: number; message?: string }>(res);

  if (typeof payload.count === 'number') {
    return { liked: Boolean(payload.liked ?? liked), count: payload.count };
  }

  const count = await getPostLikeCount(postId);
  return { liked: Boolean(payload.liked ?? liked), count };
}

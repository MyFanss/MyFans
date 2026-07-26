/**
 * Content library API client — lists creator content from Nest `/v1/content`.
 */

import { getVersionedApiBaseUrl } from '@/lib/api/base-url';
import type { ContentItem } from '@/lib/content-library';
import type { ContentType, ContentStatus } from '@/components/cards/ContentCard';

export interface ContentApiRecord {
  id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  ipfs_cid?: string;
  ipfs_url?: string | null;
  content_type?: string;
  subscription_tier?: string | null;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ContentListResponse {
  data: ContentApiRecord[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

const UPLOAD_DISABLED_MESSAGE =
  'Direct file upload is not available yet. Content is created via the metadata API (POST /api/v1/content). See DEVELOPMENT.md → Content library upload.';

function mapContentType(raw?: string): ContentType {
  switch (raw) {
    case 'video':
      return 'video';
    case 'audio':
      return 'audio';
    case 'document':
      return 'text';
    case 'image':
    default:
      return 'image';
  }
}

export function mapContentRecord(record: ContentApiRecord): ContentItem {
  const status: ContentStatus = record.is_published ? 'published' : 'draft';
  return {
    id: record.id,
    title: record.title,
    type: mapContentType(record.content_type),
    thumbnailUrl: record.ipfs_url ?? undefined,
    description: record.description ?? undefined,
    status,
    publishedAt: record.is_published ? record.created_at : undefined,
    isLocked: Boolean(record.subscription_tier),
  };
}

async function contentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getVersionedApiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? `Content request failed: ${res.status}`,
    );
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

/** List content from the backend (paginated). */
export async function fetchContentLibrary(params: {
  page?: number;
  limit?: number;
  creatorId?: string;
} = {}): Promise<ContentItem[]> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const path = params.creatorId
    ? `/content/creator/${encodeURIComponent(params.creatorId)}${query}`
    : `/content${query}`;

  const payload = await contentFetch<ContentListResponse | ContentApiRecord[]>(path);
  const rows = Array.isArray(payload) ? payload : (payload.data ?? []);
  return rows.map(mapContentRecord);
}

export async function deleteContentItems(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => contentFetch<void>(`/content/${id}`, { method: 'DELETE' })));
}

export async function archiveContentItems(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      contentFetch(`/content/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_published: false }),
      }),
    ),
  );
}

/** Upload is not wired to a file endpoint yet — always reject with a clear message. */
export function getContentUploadDisabledMessage(): string {
  return UPLOAD_DISABLED_MESSAGE;
}

export async function uploadContentFiles(_files: File[]): Promise<void> {
  throw new Error(UPLOAD_DISABLED_MESSAGE);
}

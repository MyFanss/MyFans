/**
 * Content library types, mock data, filter/sort, view preference.
 */

import type { ContentType, ContentStatus } from '@/components/cards/ContentCard';

export type ViewMode = 'grid' | 'list';

export const VIEW_PREFERENCE_KEY = 'content-library-view';

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  thumbnailUrl?: string;
  description?: string;
  status: ContentStatus;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: number;
  isLocked?: boolean;
}

export type FilterType = ContentType | 'all';
export type FilterStatus = ContentStatus | 'all';
export type SortField = 'date' | 'title' | 'views';
export type SortOrder = 'asc' | 'desc';

export interface ContentLibraryFilters {
  type: FilterType;
  status: FilterStatus;
  sortField: SortField;
  sortOrder: SortOrder;
}

const CONTENT_TYPES: ContentType[] = ['image', 'video', 'audio', 'text', 'live'];
const STATUSES: ContentStatus[] = ['published', 'draft', 'scheduled', 'archived'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockItems(count: number): ContentItem[] {
  const items: ContentItem[] = [];
  for (let i = 0; i < count; i++) {
    const type = randomItem(CONTENT_TYPES);
    items.push({
      id: `content-${i + 1}`,
      title: `Content ${i + 1} ${type}`,
      type,
      description: i % 3 === 0 ? 'Short description for this item.' : undefined,
      status: randomItem(STATUSES),
      publishedAt: i % 4 !== 0 ? new Date(Date.now() - i * 86400000).toISOString() : undefined,
      viewCount: type === 'video' || type === 'image' ? Math.floor(Math.random() * 50000) : undefined,
      likeCount: Math.floor(Math.random() * 2000),
      commentCount: Math.floor(Math.random() * 500),
      duration: type === 'video' || type === 'audio' ? 60 + Math.floor(Math.random() * 3600) : undefined,
      isLocked: i % 5 === 0,
    });
  }
  return items;
}

export const MOCK_CONTENT_ITEMS = generateMockItems(55);

export function filterAndSort(
  items: ContentItem[],
  filters: ContentLibraryFilters
): ContentItem[] {
  let result = [...items];
  if (filters.type !== 'all') {
    result = result.filter((i) => i.type === filters.type);
  }
  if (filters.status !== 'all') {
    result = result.filter((i) => i.status === filters.status);
  }
  const mult = filters.sortOrder === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    switch (filters.sortField) {
      case 'date':
        return mult * ((new Date(b.publishedAt ?? 0).getTime()) - (new Date(a.publishedAt ?? 0).getTime()));
      case 'title':
        return mult * (a.title.localeCompare(b.title));
      case 'views':
        return mult * ((b.viewCount ?? 0) - (a.viewCount ?? 0));
      default:
        return 0;
    }
  });
  return result;
}

export const CONTENT_TYPE_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All types' },
  ...CONTENT_TYPES.map((t) => ({ value: t as FilterType, label: t.charAt(0).toUpperCase() + t.slice(1) })),
];

export const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...STATUSES.map((s) => ({ value: s as FilterStatus, label: s.charAt(0).toUpperCase() + s.slice(1) })),
];

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'views', label: 'Views' },
];

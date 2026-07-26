'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ContentCard } from '@/components/cards';
import { BaseCard } from '@/components/cards/BaseCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useImageLoad } from '@/hooks/useImageLoad';
import {
  VIEW_PREFERENCE_KEY,
  filterAndSort,
  CONTENT_TYPE_OPTIONS,
  STATUS_OPTIONS,
  SORT_OPTIONS,
  type ViewMode,
  type ContentItem,
  type ContentLibraryFilters,
} from '@/lib/content-library';

const LIST_ROW_HEIGHT = 88;
const GRID_ROW_HEIGHT = 320;
const GRID_COLS = 3;

function getStoredView(): ViewMode {
  if (typeof window === 'undefined') return 'grid';
  const s = localStorage.getItem(VIEW_PREFERENCE_KEY);
  return s === 'list' ? 'list' : 'grid';
}

function setStoredView(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_PREFERENCE_KEY, mode);
  } catch {
    // ignore
  }
}

export interface ContentLibraryProps {
  /** Real items from the API. Defaults to empty — never injects mock data. */
  initialItems?: ContentItem[];
  loading?: boolean;
  error?: string | null;
  /** Shown when file upload is not available; disables the dropzone actions. */
  uploadDisabledMessage?: string | null;
  onUpload?: (files: File[]) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onBulkArchive?: (ids: string[]) => Promise<void>;
}

export function ContentLibrary({
  initialItems = [],
  loading = false,
  error = null,
  uploadDisabledMessage = null,
  onUpload,
  onBulkDelete,
  onBulkArchive,
}: ContentLibraryProps) {
  const [items, setItems] = useState<ContentItem[]>(initialItems);
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredView);
  const [filters, setFilters] = useState<ContentLibraryFilters>({
    type: 'all',
    status: 'all',
    sortField: 'date',
    sortOrder: 'desc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'archive'; ids: string[] } | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const listParentRef = useRef<HTMLDivElement>(null);

  const uploadEnabled = Boolean(onUpload) && !uploadDisabledMessage;

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filteredItems = useMemo(() => filterAndSort(items, filters), [items, filters]);
  const selectedCount = selectedIds.size;

  useEffect(() => {
    setStoredView(viewMode);
  }, [viewMode]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedCount === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  }, [filteredItems, selectedCount]);

  const runUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (!uploadEnabled || !onUpload) {
        setUploadMessage(uploadDisabledMessage ?? 'Upload is not available.');
        return;
      }
      setIsUploading(true);
      setUploadMessage(null);
      try {
        await onUpload(files);
      } catch (err) {
        setUploadMessage(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, uploadEnabled, uploadDisabledMessage],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      await runUpload(Array.from(e.dataTransfer.files));
    },
    [runUpload],
  );

  const handleConfirmBulk = useCallback(async () => {
    if (!confirmAction) return;
    const { type, ids } = confirmAction;
    setIsBulkSubmitting(true);
    try {
      if (type === 'delete' && onBulkDelete) {
        await onBulkDelete(ids);
        setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      }
      if (type === 'archive' && onBulkArchive) {
        await onBulkArchive(ids);
        setItems((prev) =>
          prev.map((i) => (ids.includes(i.id) ? { ...i, status: 'archived' as const } : i))
        );
      }
      setSelectedIds(new Set());
      setConfirmAction(null);
    } finally {
      setIsBulkSubmitting(false);
    }
  }, [confirmAction, onBulkDelete, onBulkArchive]);

  const virtualizer = useVirtualizer({
    count: viewMode === 'list' ? filteredItems.length : Math.ceil(filteredItems.length / GRID_COLS),
    getScrollElement: () => listParentRef.current,
    estimateSize: () => (viewMode === 'list' ? LIST_ROW_HEIGHT : GRID_ROW_HEIGHT),
    overscan: 5,
  });

  const useVirtual = filteredItems.length >= 50;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
            }`}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
          >
            <span className="sr-only">Grid</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm6 0a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6 0a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
            }`}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
          >
            <span className="sr-only">List</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as ContentLibraryFilters['type'] }))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          {CONTENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as ContentLibraryFilters['status'] }))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label htmlFor="sort-field" className="text-sm text-gray-500 dark:text-gray-400">Sort</label>
          <select
            id="sort-field"
            value={filters.sortField}
            onChange={(e) => setFilters((f) => ({ ...f, sortField: e.target.value as ContentLibraryFilters['sortField'] }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' }))}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label={filters.sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
            title={filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 dark:text-gray-300">{selectedCount} selected</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {selectedCount === filteredItems.length ? 'Deselect all' : 'Select all'}
            </button>
            {onBulkArchive && (
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'archive', ids: Array.from(selectedIds) })}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Archive
              </button>
            )}
            {onBulkDelete && (
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'delete', ids: Array.from(selectedIds) })}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (uploadEnabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
        } ${!uploadEnabled ? 'opacity-80' : ''}`}
      >
        {uploadDisabledMessage ? (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            {uploadDisabledMessage}
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Drag and drop files here, or{' '}
            <button
              type="button"
              onClick={() => document.getElementById('content-upload-input')?.click()}
              className="text-primary-600 dark:text-primary-400 hover:underline"
              disabled={!uploadEnabled}
            >
              browse
            </button>
          </p>
        )}
        {isUploading && <p className="text-sm text-gray-500 mt-2">Uploading…</p>}
        {uploadMessage && !uploadDisabledMessage && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2" role="status">
            {uploadMessage}
          </p>
        )}
        <input
          id="content-upload-input"
          type="file"
          multiple
          className="sr-only"
          disabled={!uploadEnabled}
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            await runUpload(files);
          }}
        />
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      <div
        ref={listParentRef}
        className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        style={{ minHeight: 400, maxHeight: 600 }}
      >
        {loading && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" rounded="lg" />
            ))}
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16" role="status">
            <div
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4"
              aria-hidden
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No content yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              {error
                ? 'We could not load your library. Try again once the API is reachable.'
                : 'Your content library is empty. Create content via the metadata API when upload is enabled.'}
            </p>
          </div>
        )}

        {!loading && viewMode === 'grid' && !useVirtual && filteredItems.length > 0 && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <GridCard
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
              />
            ))}
          </div>
        )}
        {!loading && viewMode === 'grid' && useVirtual && (
          <div
            style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
            className="p-4"
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const start = virtualRow.index * GRID_COLS;
              const slice = filteredItems.slice(start, start + GRID_COLS);
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {slice.map((item) => (
                    <GridCard
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {!loading && viewMode === 'list' && !useVirtual && filteredItems.length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredItems.map((item) => (
              <ListRow
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
              />
            ))}
          </ul>
        )}
        {!loading && viewMode === 'list' && useVirtual && (
          <ul
            style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
            className="divide-y divide-gray-200 dark:divide-gray-700"
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = filteredItems[virtualRow.index];
              if (!item) return null;
              return (
                <li
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: LIST_ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ListRow
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <BaseCard padding="lg" className="max-w-sm w-full">
            <h3 id="confirm-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {confirmAction.type === 'delete' ? 'Delete content?' : 'Archive content?'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {confirmAction.type === 'delete'
                ? `This will permanently delete ${confirmAction.ids.length} item(s). This cannot be undone.`
                : `Archive ${confirmAction.ids.length} item(s)? You can restore them later.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isBulkSubmitting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulk}
                disabled={isBulkSubmitting}
                className={`px-4 py-2 rounded-lg text-white font-medium ${
                  confirmAction.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary-600 hover:bg-primary-700'
                } disabled:opacity-50`}
              >
                {isBulkSubmitting ? 'Please wait…' : confirmAction.type === 'delete' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </BaseCard>
        </div>
      )}
    </div>
  );
}

function GridCard({
  item,
  isSelected,
  onToggleSelect,
}: {
  item: ContentItem;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div className="relative">
      <label className="absolute top-2 left-2 z-10 flex items-center justify-center w-6 h-6 rounded border-2 bg-white dark:bg-gray-800 cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="sr-only"
          aria-label={`Select ${item.title}`}
        />
        {isSelected ? (
          <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="w-4 h-4 border-2 border-gray-400 rounded" />
        )}
      </label>
      <ContentCard
        title={item.title}
        type={item.type}
        thumbnailUrl={item.thumbnailUrl}
        description={item.description}
        status={item.status}
        publishedAt={item.publishedAt}
        viewCount={item.viewCount}
        likeCount={item.likeCount}
        commentCount={item.commentCount}
        duration={item.duration}
        isLocked={item.isLocked}
      />
    </div>
  );
}

function ListRow({
  item,
  isSelected,
  onToggleSelect,
}: {
  item: ContentItem;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const thumbnailLoad = useImageLoad();

  return (
    <label className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        aria-label={`Select ${item.title}`}
      />
      <div className="image-skeleton-wrapper relative flex-shrink-0 w-24 h-14 rounded overflow-hidden">
        {item.thumbnailUrl ? (
          <>
            <img
              src={item.thumbnailUrl}
              alt=""
              width={96}
              height={56}
              loading="lazy"
              onLoad={thumbnailLoad.onLoad}
              className={`lazy-image w-full h-full object-cover ${
                thumbnailLoad.isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
            {!thumbnailLoad.isLoaded && (
              <Skeleton className="absolute inset-0" rounded="md" />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            <span className="text-xs">{item.type}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{item.status}</p>
      </div>
      <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{item.type}</span>
    </label>
  );
}

export default ContentLibrary;

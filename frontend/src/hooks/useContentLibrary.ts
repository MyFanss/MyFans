'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContentItem } from '@/lib/content-library';
import {
  archiveContentItems,
  deleteContentItems,
  fetchContentLibrary,
  getContentUploadDisabledMessage,
  uploadContentFiles,
} from '@/lib/content-api';

export interface UseContentLibraryResult {
  items: ContentItem[];
  loading: boolean;
  error: string | null;
  uploadDisabledMessage: string;
  refresh: () => Promise<void>;
  onUpload: (files: File[]) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onBulkArchive: (ids: string[]) => Promise<void>;
}

export function useContentLibrary(creatorId?: string): UseContentLibraryResult {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContentLibrary({ limit: 100, creatorId });
      setItems(data);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Failed to load content library');
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onUpload = useCallback(async (files: File[]) => {
    await uploadContentFiles(files);
  }, []);

  const onBulkDelete = useCallback(
    async (ids: string[]) => {
      await deleteContentItems(ids);
      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    },
    [],
  );

  const onBulkArchive = useCallback(async (ids: string[]) => {
    await archiveContentItems(ids);
    setItems((prev) =>
      prev.map((item) => (ids.includes(item.id) ? { ...item, status: 'archived' as const } : item)),
    );
  }, []);

  return {
    items,
    loading,
    error,
    uploadDisabledMessage: getContentUploadDisabledMessage(),
    refresh,
    onUpload,
    onBulkDelete,
    onBulkArchive,
  };
}

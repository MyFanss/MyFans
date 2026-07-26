'use client';

import { DashboardSectionBoundary } from '@/components/dashboard';
import { ContentLibrary } from '@/components/content-library';
import { useContentLibrary } from '@/hooks/useContentLibrary';

export default function ContentPage() {
  const {
    items,
    loading,
    error,
    uploadDisabledMessage,
    onUpload,
    onBulkDelete,
    onBulkArchive,
  } = useContentLibrary();

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Content Library</h1>
      <DashboardSectionBoundary label="Content library">
        <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <ContentLibrary
            initialItems={items}
            loading={loading}
            error={error}
            uploadDisabledMessage={uploadDisabledMessage}
            onUpload={onUpload}
            onBulkDelete={onBulkDelete}
            onBulkArchive={onBulkArchive}
          />
        </div>
      </DashboardSectionBoundary>
    </div>
  );
}

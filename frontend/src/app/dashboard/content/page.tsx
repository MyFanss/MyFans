'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardSectionBoundary } from '@/components/dashboard';
import { ContentLibrary } from '@/components/content-library';
import { useContentLibrary } from '@/hooks/useContentLibrary';
import { useAuth } from '@/hooks/useAuth';

export default function ContentPage() {
  const router = useRouter();
  const { isAuthenticated, sessionData, isLoading: authLoading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    items,
    loading,
    error,
    uploadDisabledMessage,
    onUpload,
    onBulkDelete,
    onBulkArchive,
  } = useContentLibrary(sessionData?.creator?.id);

  // Enforce authorization: only creators can access this page
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setAuthError('You must be logged in to access the content library');
      router.push('/auth/sign-in');
    } else if (!authLoading && sessionData && !sessionData.is_creator) {
      setAuthError('Only creators can manage content');
    }
  }, [isAuthenticated, authLoading, sessionData, router]);

  if (authError) {
    return (
      <div className="max-w-full">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Content Library</h1>
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 p-4">
          <p className="text-red-700 dark:text-red-300 font-medium text-sm">{authError}</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="max-w-full">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Content Library</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

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

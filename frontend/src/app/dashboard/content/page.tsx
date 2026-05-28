'use client';

import { useImageUpload } from '@/hooks/useImageUpload';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { DashboardSectionBoundary } from '@/components/dashboard';

export default function ContentPage() {
  const { upload } = useImageUpload({ endpoint: '/api/content/upload' });

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Content Library</h1>
      <DashboardSectionBoundary label="Content upload">
        <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-gray-800 space-y-6">
          <ImageUpload
            label="Upload Content"
            onUpload={upload}
            hint="JPG, PNG, or WebP • Max 10MB"
          />
        </div>
      </DashboardSectionBoundary>
    </div>
  );
}

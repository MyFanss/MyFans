import { ContentPageSkeleton } from '@/components/ui/ContentPageSkeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="h-16 border-b border-gray-200 dark:border-gray-800" />
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <ContentPageSkeleton />
      </main>
    </div>
  );
}

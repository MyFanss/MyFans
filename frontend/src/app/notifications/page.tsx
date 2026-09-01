'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NotificationInbox from '@/components/notifications/NotificationInbox';
import { fetchMe, ProfileUnauthorizedError } from '@/lib/api/profile';

export default function NotificationsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        await fetchMe();
        if (!cancelled) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ProfileUnauthorizedError) {
            router.push('/signin');
          } else {
            setIsAuthenticated(false);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-slate-600 dark:text-slate-400">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-300">
            Please sign in to view your notifications.
          </p>
          <button
            onClick={() => router.push('/signin')}
            className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return <NotificationInbox />;
}

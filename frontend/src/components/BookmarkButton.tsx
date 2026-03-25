'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';

interface BookmarkButtonProps {
  creatorId: string;
  className?: string;
  showLabel?: boolean;
}

export function BookmarkButton({ creatorId, className = '', showLabel = false }: BookmarkButtonProps) {
  const { isFavorite, isLoading, isPending, toggle } = useFavorites();
  const active = isFavorite(creatorId);
  const pending = isPending(creatorId);

  return (
    <button
      aria-busy={pending}
      aria-label={active ? 'Remove bookmark' : 'Add bookmark'}
      aria-pressed={active}
      className={`inline-flex items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        showLabel ? 'gap-2 px-4 py-2 text-sm font-medium' : 'h-10 w-10'
      } ${
        active
          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-500/10 dark:text-primary-200'
          : 'border-gray-200 bg-white text-gray-500 hover:border-primary-300 hover:text-primary-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-primary-500 dark:hover:text-primary-300'
      } ${className}`}
      disabled={isLoading || pending}
      onClick={() => void toggle(creatorId)}
      type="button"
    >
      {active ? (
        <BookmarkCheck aria-hidden="true" className="h-4 w-4" data-testid="bookmark-filled-icon" />
      ) : (
        <Bookmark aria-hidden="true" className="h-4 w-4" data-testid="bookmark-outline-icon" />
      )}
      {showLabel ? <span>{active ? 'Bookmarked' : 'Bookmark'}</span> : null}
    </button>
  );
}

export default BookmarkButton;

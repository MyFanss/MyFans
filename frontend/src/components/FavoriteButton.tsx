'use client';

import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/hooks/useAuth';

interface FavoriteButtonProps {
  creatorId: string;
  className?: string;
  showLabel?: boolean;
}

export function FavoriteButton({ creatorId, className = '', showLabel = false }: FavoriteButtonProps) {
  const { isFavorite, toggle, isPending, isLoading } = useFavorites();
  const { isAuthenticated } = useAuth();

  const favorited = isFavorite(creatorId);
  const pending = isPending(creatorId);
  const isDisabled = pending || isLoading || !isAuthenticated;

  const handleClick = async () => {
    if (isDisabled) return;
    await toggle(creatorId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      title={favorited ? 'Remove from favorites' : 'Add to favorites'}
      className={`${className} inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
        favorited
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`text-lg ${pending ? 'animate-pulse' : ''}`}>
        {favorited ? '⭐' : '☆'}
      </span>
      {showLabel && <span className="text-sm">{favorited ? 'Favorited' : 'Add to Favorites'}</span>}
    </button>
  );
}

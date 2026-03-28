'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { addFavorite, getFavorites, removeFavorite } from '@/lib/favorites';

interface FavoritesContextValue {
  favorites: string[];
  isFavorite: (creatorId: string) => boolean;
  isLoading: boolean;
  isPending: (creatorId: string) => boolean;
  toggle: (creatorId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

function logFavoritesError(message: string, error: unknown) {
  if (process.env.NODE_ENV !== 'test') {
    console.error(message, error);
  }
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const favoritesRef = useRef<string[]>([]);
  const pendingIdsRef = useRef<string[]>([]);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    pendingIdsRef.current = pendingIds;
  }, [pendingIds]);

  useEffect(() => {
    let isActive = true;

    const loadFavorites = async () => {
      try {
        const creatorIds = await getFavorites();

        if (!isActive) {
          return;
        }

        favoritesRef.current = creatorIds;
        setFavorites(creatorIds);
      } catch (error) {
        logFavoritesError('Failed to load favorites.', error);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadFavorites();

    return () => {
      isActive = false;
    };
  }, []);

  const isFavorite = (creatorId: string) => favorites.includes(creatorId);
  const isPending = (creatorId: string) => pendingIds.includes(creatorId);

  const toggle = async (creatorId: string) => {
    if (pendingIdsRef.current.includes(creatorId)) {
      return;
    }

    const wasFavorite = favoritesRef.current.includes(creatorId);

    setPendingIds((current) => {
      const nextPending = current.includes(creatorId) ? current : [...current, creatorId];
      pendingIdsRef.current = nextPending;
      return nextPending;
    });

    setFavorites((current) => {
      const nextFavorites = wasFavorite
        ? current.filter((id) => id !== creatorId)
        : current.includes(creatorId)
          ? current
          : [...current, creatorId];

      favoritesRef.current = nextFavorites;
      return nextFavorites;
    });

    try {
      if (wasFavorite) {
        await removeFavorite(creatorId);
      } else {
        await addFavorite(creatorId);
      }
    } catch (error) {
      setFavorites((current) => {
        const nextFavorites = wasFavorite
          ? current.includes(creatorId)
            ? current
            : [...current, creatorId]
          : current.filter((id) => id !== creatorId);

        favoritesRef.current = nextFavorites;
        return nextFavorites;
      });

      logFavoritesError('Failed to update favorites.', error);
    } finally {
      setPendingIds((current) => {
        const nextPending = current.filter((id) => id !== creatorId);
        pendingIdsRef.current = nextPending;
        return nextPending;
      });
    }
  };

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, isLoading, isPending, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }

  return context;
}

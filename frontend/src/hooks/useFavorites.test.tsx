import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesProvider, useFavorites } from '@/hooks/useFavorites';
import { addFavorite, getFavorites, removeFavorite } from '@/lib/favorites';

vi.mock('@/lib/favorites', () => ({
  addFavorite: vi.fn(),
  getFavorites: vi.fn(),
  removeFavorite: vi.fn(),
}));

const mockAddFavorite = vi.mocked(addFavorite);
const mockGetFavorites = vi.mocked(getFavorites);
const mockRemoveFavorite = vi.mocked(removeFavorite);

function wrapper({ children }: { children: React.ReactNode }) {
  return <FavoritesProvider>{children}</FavoritesProvider>;
}

describe('useFavorites', () => {
  beforeEach(() => {
    mockAddFavorite.mockReset();
    mockGetFavorites.mockReset();
    mockRemoveFavorite.mockReset();
    mockGetFavorites.mockResolvedValue([]);
  });

  it('renders with empty favorites', async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.favorites).toEqual([]);
  });

  it('loads favorites from the backend on mount', async () => {
    mockGetFavorites.mockResolvedValue(['creator-1', 'creator-2']);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.favorites).toEqual(['creator-1', 'creator-2']);
    });
  });

  it('toggles bookmark on and calls addFavorite', async () => {
    mockAddFavorite.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggle('creator-1');
    });

    expect(mockAddFavorite).toHaveBeenCalledWith('creator-1');
    expect(result.current.favorites).toEqual(['creator-1']);
    expect(result.current.isFavorite('creator-1')).toBe(true);
  });

  it('toggles bookmark off and calls removeFavorite', async () => {
    mockGetFavorites.mockResolvedValue(['creator-1']);
    mockRemoveFavorite.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.favorites).toEqual(['creator-1']);
    });

    await act(async () => {
      await result.current.toggle('creator-1');
    });

    expect(mockRemoveFavorite).toHaveBeenCalledWith('creator-1');
    expect(result.current.favorites).toEqual([]);
    expect(result.current.isFavorite('creator-1')).toBe(false);
  });

  it('rolls back optimistic updates on API failure', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    let togglePromise: Promise<void> | undefined;

    mockAddFavorite.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectRequest = reject;
        }),
    );

    const { result } = renderHook(() => useFavorites(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      togglePromise = result.current.toggle('creator-1');
    });

    await waitFor(() => {
      expect(result.current.isFavorite('creator-1')).toBe(true);
    });

    await act(async () => {
      rejectRequest?.(new Error('Request failed'));
      await togglePromise;
    });

    expect(result.current.isFavorite('creator-1')).toBe(false);
    expect(result.current.favorites).toEqual([]);
  });
});

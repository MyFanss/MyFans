import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkButton } from '@/components/BookmarkButton';
import { FavoritesProvider } from '@/hooks/useFavorites';
import { addFavorite, getFavorites, removeFavorite } from '@/lib/favorites';

vi.mock('@/lib/favorites', () => ({
  addFavorite: vi.fn(),
  getFavorites: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  Bookmark: (props: React.ComponentProps<'svg'>) => <svg {...props} />,
  BookmarkCheck: (props: React.ComponentProps<'svg'>) => <svg {...props} />,
}));

const mockAddFavorite = vi.mocked(addFavorite);
const mockGetFavorites = vi.mocked(getFavorites);
const mockRemoveFavorite = vi.mocked(removeFavorite);

function renderWithFavorites(creatorId: string) {
  return render(
    <FavoritesProvider>
      <BookmarkButton creatorId={creatorId} />
    </FavoritesProvider>,
  );
}

describe('BookmarkButton', () => {
  beforeEach(() => {
    mockAddFavorite.mockReset();
    mockGetFavorites.mockReset();
    mockRemoveFavorite.mockReset();
    mockGetFavorites.mockResolvedValue([]);
  });

  it('renders bookmark outline when not favorited', async () => {
    renderWithFavorites('creator-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add bookmark' })).toHaveAttribute('aria-pressed', 'false');
    });

    expect(screen.getByTestId('bookmark-outline-icon')).toBeInTheDocument();
  });

  it('renders bookmark filled when favorited', async () => {
    mockGetFavorites.mockResolvedValue(['creator-1']);

    renderWithFavorites('creator-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute('aria-pressed', 'true');
    });

    expect(screen.getByTestId('bookmark-filled-icon')).toBeInTheDocument();
  });

  it('calls toggle on click', async () => {
    mockAddFavorite.mockResolvedValue(undefined);

    renderWithFavorites('creator-1');

    const button = await screen.findByRole('button', { name: 'Add bookmark' });
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAddFavorite).toHaveBeenCalledWith('creator-1');
    });
  });

  it('updates aria-pressed when the favorite state changes', async () => {
    mockAddFavorite.mockResolvedValue(undefined);
    mockGetFavorites.mockResolvedValue(['creator-1']);
    mockRemoveFavorite.mockResolvedValue(undefined);

    renderWithFavorites('creator-1');

    const button = await screen.findByRole('button', { name: 'Remove bookmark' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRemoveFavorite).toHaveBeenCalledWith('creator-1');
      expect(screen.getByRole('button', { name: 'Add bookmark' })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

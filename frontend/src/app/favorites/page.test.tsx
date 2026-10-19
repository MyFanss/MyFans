import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FavoritesPage from './page';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));

// Mirrors the next/link mock in DashboardNav.test.tsx: render a plain <a>
// without the Next.js router.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as any;
}

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an error message with role="alert" and a retry control instead of the empty state when the load fails', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse(500, {}));
    render(<FavoritesPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error loading favorites (500)');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/haven't marked any creators/i)).not.toBeInTheDocument();
  });

  it('clicking retry issues a new GET /api/v1/favorites request', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, []));
    render(<FavoritesPage />);

    const retry = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retry);

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/v1/favorites', { method: 'GET' });
  });

  it('shows the genuine empty state only when there is no error', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(jsonResponse(200, []));
    render(<FavoritesPage />);

    expect(await screen.findByText(/haven't marked any creators/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a TOGGLE_ROLLBACK error while the existing favorite remains listed', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse(200, ['creator-1']))
      .mockResolvedValueOnce(jsonResponse(500, {}));
    render(<FavoritesPage />);

    const removeBtn = await screen.findByRole('button', { name: /remove creator-1/i });
    fireEvent.click(removeBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to update favorite. Please try again.');
    // Rollback restores the id — it must still be listed, not dropped.
    expect(screen.getByText('creator-1')).toBeInTheDocument();
  });
});

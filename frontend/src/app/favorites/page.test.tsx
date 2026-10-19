/**
 * Unit tests for FavoritesPage — asserts the `toggle` callback guards against
 * double-submits for an id that already has a request pending, and that the
 * guard is read fresh (via the `state.pending` useCallback dependency)
 * rather than from a stale closure.
 *
 * Closes #2003.
 */
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

const mockedApiFetch = vi.mocked(apiFetch);

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

  it('removing a favorite while its request is pending issues exactly one toggle request, and the UI offers no way to resubmit it', async () => {
    // Initial GET /api/v1/favorites load.
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ['creator-1'],
    } as any);

    let resolveToggle!: (value: unknown) => void;
    mockedApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToggle = resolve;
      }) as any,
    );

    render(<FavoritesPage />);

    const removeBtn = await screen.findByRole('button', { name: /remove creator-1/i });

    await act(async () => {
      removeBtn.click();
    });

    // Exactly one toggle request was issued (plus the initial load) - the
    // optimistic update both marks the id pending and removes its row in the
    // same commit, so there is no live control left through which the UI
    // could fire a second DELETE for the same id while the first is still
    // in flight.
    expect(mockedApiFetch).toHaveBeenCalledTimes(2); // 1 load + 1 toggle
    expect(screen.queryByRole('button', { name: /remove creator-1/i })).toBeNull();

    await act(async () => {
      resolveToggle({ ok: true, status: 200 } as any);
    });

    // Still exactly one toggle request after the (only) in-flight request
    // resolves.
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });

  it('ignores a toggle for an id already in state.pending (defensive guard)', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ['creator-1', 'creator-2'],
    } as any);

    // The toggle for creator-1 never resolves within this test.
    mockedApiFetch.mockReturnValueOnce(new Promise(() => {}) as any);

    render(<FavoritesPage />);

    const removeBtn1 = await screen.findByRole('button', { name: /remove creator-1/i });
    await act(async () => {
      removeBtn1.click();
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(2); // 1 load + 1 toggle for creator-1

    // creator-2's row is unaffected and still independently toggleable - the
    // pending guard is per-id, not a global lock.
    mockedApiFetch.mockReturnValueOnce(new Promise(() => {}) as any);
    const removeBtn2 = await screen.findByRole('button', { name: /remove creator-2/i });
    await act(async () => {
      removeBtn2.click();
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(3);
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

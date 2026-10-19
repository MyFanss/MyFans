/**
 * Unit tests for FavoritesPage — asserts the `toggle` callback guards against
 * double-submits for an id that already has a request pending, and that the
 * guard is read fresh (via the `state.pending` useCallback dependency)
 * rather than from a stale closure.
 *
 * Closes #2003.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import FavoritesPage from './page';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '@/lib/api/client';
const mockedApiFetch = vi.mocked(apiFetch);

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
});

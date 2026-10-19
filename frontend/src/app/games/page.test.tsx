import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GamesPage from './page';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GamesPage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('renders the unauthenticated state on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)));
    render(<GamesPage />);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/signed in/i),
    );
  });

  it('renders the server_error state on a 500 and retries on click', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(
        jsonResponse({ data: [], limit: 20, nextCursor: null, hasMore: false }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<GamesPage />);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/encountered an issue/i),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading games' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText('No games available right now.')).toBeTruthy(),
    );
  });
});

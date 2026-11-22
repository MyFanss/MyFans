import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiscoverPage from './page';

// Mirrors the next/link mock in DashboardNav.test.tsx: render a plain <a>
// without the Next.js router.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('DiscoverPage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('shows loading status before fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<DiscoverPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading creators/)).toBeInTheDocument();
  });

  it('renders empty-state message when data array is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ creators: [] }),
      }),
    );
    render(<DiscoverPage />);
    expect(await screen.findByText(/No creators found yet/)).toBeInTheDocument();
  });

  it('renders error alert for non-OK (500) response and not the empty message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );
    render(<DiscoverPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/No creators found yet/)).not.toBeInTheDocument();
  });

  it('renders creator cards for populated data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          creators: [
            {
              id: '1',
              handle: 'user1',
              displayName: 'User One',
              avatarUrl: null,
              subscriberCount: 100,
            },
            {
              id: '2',
              handle: 'user2',
              displayName: 'User Two',
              avatarUrl: '/avatar.jpg',
              subscriberCount: 200,
            },
          ],
        }),
      }),
    );
    render(<DiscoverPage />);
    expect(await screen.findByText('User One')).toBeInTheDocument();
    expect(await screen.findByText('@user1')).toBeInTheDocument();
    expect(await screen.findByText('User Two')).toBeInTheDocument();
    expect(await screen.findByText('@user2')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /User One/ })).toHaveAttribute(
      'href',
      '/creator/user1',
    );
  });

  it('does not fire a request for a single-character search term', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ creators: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiscoverPage />);
    await screen.findByText(/No creators found yet/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(/search creators/i), {
      target: { value: 'a' },
    });

    // Give the debounce timer a chance to fire; it must not, for one char.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fires a request with `q` once two characters are typed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ creators: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiscoverPage />);
    await screen.findByText(/No creators found yet/);

    fireEvent.change(screen.getByLabelText(/search creators/i), {
      target: { value: 'an' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const lastCallUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(lastCallUrl).toContain('q=an');
  });

  it('shows a search-specific empty state when a query matches nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ creators: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DiscoverPage />);
    await screen.findByText(/No creators found yet/);

    fireEvent.change(screen.getByLabelText(/search creators/i), {
      target: { value: 'zz' },
    });

    expect(await screen.findByText(/No creators match/)).toBeInTheDocument();
  });
});
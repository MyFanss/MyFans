import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DiscoverPage from './page';

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
    // The loading status is mutually exclusive with the resolved states; it
    // must not be left on screen once the request has settled (#2217).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    // Same regression as the empty-state case: loading text must clear once
    // the request settles, even on the error path (#2217).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
  });
});
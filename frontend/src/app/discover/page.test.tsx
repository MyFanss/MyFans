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
        json: async () => ({ data: [] }),
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
          data: [
            {
              id: '1',
              username: 'user1',
              displayName: 'User One',
              avatarUrl: null,
              subscriberCount: 100,
            },
            {
              id: '2',
              username: 'user2',
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
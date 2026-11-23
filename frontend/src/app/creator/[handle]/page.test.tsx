import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import CreatorProfilePage from './page';

describe('CreatorProfilePage', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  function creatorsResponse(creators: unknown[]) {
    return { ok: true, json: async () => ({ creators }) };
  }

  function plansResponse(plans: unknown[]) {
    return { ok: true, json: async () => ({ plans }) };
  }

  it('shows a loading status before data resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<CreatorProfilePage params={{ handle: 'user1' }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the matching creator profile and their plans', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          creatorsResponse([
            {
              id: 'c1',
              handle: 'user1',
              displayName: 'User One',
              avatarUrl: null,
              bio: 'Making things.',
              subscriberCount: 42,
              isVerified: false,
            },
          ]),
        )
        .mockResolvedValueOnce(
          plansResponse([
            {
              id: 'p1',
              name: 'Basic',
              description: null,
              price: 5,
              currency: 'USD',
              interval: 'month',
              isActive: true,
            },
          ]),
        ),
    );

    render(<CreatorProfilePage params={{ handle: 'user1' }} />);

    expect(await screen.findByText('User One')).toBeInTheDocument();
    expect(screen.getByText('@user1')).toBeInTheDocument();
    expect(screen.getByText('Making things.')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
  });

  it('shows a not-found message when no creator matches the handle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(creatorsResponse([])));

    render(<CreatorProfilePage params={{ handle: 'missing' }} />);

    expect(await screen.findByText(/Creator not found/)).toBeInTheDocument();
  });

  it('shows an error state when the creators request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<CreatorProfilePage params={{ handle: 'user1' }} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

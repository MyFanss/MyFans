import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PendingPage, { isStuck, fetchPending, type PendingItem } from './PendingPage';

vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

const now = 1_700_000_000_000;
const base: PendingItem = { id: '1', kind: 'checkout', status: 'pending', createdAt: new Date(now).toISOString() };
const STUCK = 30 * 60 * 1000;

describe('isStuck', () => {
  it('covers stuck status, threshold, and invalid date', () => {
    expect(isStuck({ ...base, status: 'stuck' }, now)).toBe(true);
    expect(isStuck({ ...base, createdAt: new Date(now - 10 * 60 * 1000).toISOString() }, now)).toBe(false);
    expect(isStuck({ ...base, createdAt: new Date(now - STUCK - 1).toISOString() }, now)).toBe(true);
    expect(isStuck({ ...base, createdAt: 'not-a-date' }, now)).toBe(false);
  });
});

describe('fetchPending', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('returns items array on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: 'a', kind: 'checkout', status: 'pending', createdAt: new Date().toISOString() }] }) }));
    const items = await fetchPending(new AbortController().signal);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('a');
  });
  it('returns [] when items is missing or not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await fetchPending(new AbortController().signal)).toEqual([]);
  });
  it('rejects on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchPending(new AbortController().signal)).rejects.toThrow();
  });
});

describe('PendingPage rendering', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('shows loading state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<PendingPage />);
    expect(screen.getByText(/Loading pending items/)).toBeInTheDocument();
  });
  it('renders error alert with no list items on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<PendingPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
  it('renders empty-state copy when items is []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    render(<PendingPage />);
    expect(await screen.findByText(/Nothing is pending/)).toBeInTheDocument();
  });
  it('renders an item row with the stuck badge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: '1', kind: 'checkout', status: 'stuck', createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString() }] }) }));
    render(<PendingPage />);
    expect(await screen.findByText(/Taking longer than expected/)).toBeInTheDocument();
  });
  it('no state update or rendered item when unmounted before fetch resolves', async () => {
    let resolveFetch!: () => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<{ ok: boolean; json: () => Promise<unknown> }>((r) => { resolveFetch = () => r({ ok: true, json: async () => ({ items: [{ id: '1', kind: 'checkout', status: 'pending', createdAt: new Date().toISOString() }] }) }); })));
    const { unmount } = render(<PendingPage />);
    unmount();
    resolveFetch();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});

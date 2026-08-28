'use client';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionsPage from './page';

// Minimal mocks for dependencies
vi.mock('@/lib/formatting', () => ({
  formatCurrency: (amount: number, currency: string) => `${currency}${amount}`,
  formatDate: (iso: string) => iso,
  getCurrencySymbol: (c: string) => c,
}));

vi.mock('@/components/cards/BaseCard', () => ({
  BaseCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/HistoryCardSkeleton', () => ({
  default: () => <div data-testid="history-skeleton" />,
}));

vi.mock('@/components/ui/ActiveSubscriptionSkeleton', () => ({
  default: () => <div data-testid="active-skeleton" />,
}));

vi.mock('@/lib/error-copy', () => ({
  subscriptionActionToast: { cancelFailed: () => 'cancel failed', renewFailed: () => 'renew failed' },
  subscriptionsLoadFailed: () => 'load failed',
}));

vi.mock('@/lib/stellar', () => ({
  cancelSubscriptionOnSoroban: vi.fn(),
  extendSubscriptionOnSoroban: vi.fn(),
  getStellarConfig: () => ({ network: 'testnet', tokenContractId: 'C_TOKEN' }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showInfo: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showLoading: vi.fn().mockReturnValue('toast-id'),
    dismiss: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makePagedResponse(items: unknown[] = []) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: items, total: items.length, hasMore: false, nextCursor: null }),
  });
}

/** URLs `fetch` was called with (first arg of each call). */
function fetchedUrls(): string[] {
  return mockFetch.mock.calls.map((call) => String(call[0]));
}

/** Assert some `fetch` call targeted a URL containing `substr`. */
function expectFetched(substr: string) {
  expect(fetchedUrls().some((url) => url.includes(substr))).toBe(true);
}

describe('SubscriptionsPage – filter and sort controls', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockReturnValue(makePagedResponse([]));
  });

  it('renders status filter and sort select controls', async () => {
    render(<SubscriptionsPage />);

    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort subscriptions')).toBeInTheDocument();
  });

  it('fetches with default status=active and sort=expiry on mount', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expectFetched('status=active');
      expectFetched('sort=expiry');
    });
  });

  it('re-fetches when status filter changes to expired', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expectFetched('status=active'));

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'expired' },
    });

    await waitFor(() => expectFetched('status=expired'));
  });

  it('re-fetches when status filter changes to cancelled', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expectFetched('status=active'));

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'cancelled' },
    });

    await waitFor(() => expectFetched('status=cancelled'));
  });

  it('re-fetches when sort changes to created', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expectFetched('status=active'));

    fireEvent.change(screen.getByLabelText('Sort subscriptions'), {
      target: { value: 'created' },
    });

    await waitFor(() => expectFetched('sort=created'));
  });

  it('calls the correct API endpoint', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expectFetched('/api/v1/subscriptions/me/list'));
  });

  it('shows empty state when API returns no subscriptions', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('No subscriptions found')).toBeInTheDocument();
    });
  });

  it('fetches history and payments on mount', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expectFetched('/api/v1/subscriptions/me/list?status=cancelled');
      expectFetched('/api/v1/analytics/payments');
    });
  });

  it('renders history and payment empty states when API returns empty data', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('No subscription history')).toBeInTheDocument();
      expect(screen.getByText('No payments yet')).toBeInTheDocument();
    });
  });

  it('renders history items and payment cards when API returns data', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('status=cancelled')) {
        return makePagedResponse([
          {
            id: 'hist-101',
            creatorName: 'Artist Creator',
            planName: 'VIP Tier',
            price: 15.00,
            currency: 'USDC',
            startedAt: '2026-01-01T00:00:00Z',
            endedAt: '2026-02-01T00:00:00Z',
            cancelReason: 'User choice',
          },
        ]);
      }
      if (url.includes('/analytics/payments')) {
        return makePagedResponse([
          {
            id: 'pay-202',
            date: '2026-02-15T00:00:00Z',
            creatorName: 'Video Producer',
            planName: 'Monthly Access',
            amount: 25.00,
            currency: 'XLM',
            status: 'completed',
          },
        ]);
      }
      return makePagedResponse([]);
    });

    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Artist Creator · VIP Tier/)).toBeInTheDocument();
      expect(screen.getByText(/Video Producer · Monthly Access/)).toBeInTheDocument();
      expect(screen.getByText('User choice')).toBeInTheDocument();
    });
  });

  it('shows history skeletons while history is loading', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('status=cancelled') || url.includes('/analytics/payments')) {
        return new Promise(() => {}); // pending promise
      }
      return makePagedResponse([]);
    });

    render(<SubscriptionsPage />);

    await waitFor(() => {
      const historySkeletons = screen.getAllByTestId('history-skeleton');
      expect(historySkeletons.length).toBeGreaterThan(0);
    });
  });
});

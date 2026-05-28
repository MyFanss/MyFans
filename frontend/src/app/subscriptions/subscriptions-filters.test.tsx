'use client';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionsPage from './page';

// Minimal mocks for dependencies
vi.mock('@/lib/subscriptions', () => ({
  MOCK_HISTORY: [],
  MOCK_PAYMENTS: [],
}));

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
    json: () => Promise.resolve({ data: items, total: items.length, hasMore: false, nextCursor: null }),
  });
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
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=active'),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=expiry'),
      );
    });
  });

  it('re-fetches when status filter changes to expired', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'expired' },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=expired'),
      );
    });
  });

  it('re-fetches when status filter changes to cancelled', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'cancelled' },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=cancelled'),
      );
    });
  });

  it('re-fetches when sort changes to created', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Sort subscriptions'), {
      target: { value: 'created' },
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=created'),
      );
    });
  });

  it('calls the correct API endpoint', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/subscriptions/me/list'),
      );
    });
  });

  it('shows empty state when API returns no subscriptions', async () => {
    render(<SubscriptionsPage />);

    await waitFor(() => {
      expect(screen.getByText('No subscriptions found')).toBeInTheDocument();
    });
  });

  it('shows error state gracefully when fetch fails', async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: false }));

    render(<SubscriptionsPage />);

    // Should not throw; loading state resolves
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('shows skeletons while loading active subscriptions', async () => {
    // Return a promise that doesn't resolve immediately
    mockFetch.mockReturnValue(new Promise(() => {}));
    
    render(<SubscriptionsPage />);
    
    // Should show multiple skeletons
    const skeletons = screen.getAllByTestId('active-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

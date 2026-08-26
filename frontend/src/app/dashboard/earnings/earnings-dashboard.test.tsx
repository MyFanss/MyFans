import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardEarningsPage from './page';
import * as authHooks from '@/hooks/useAuth';
import * as earningsApi from '@/lib/earnings-api';

vi.mock('@/hooks/useAuth');
vi.mock('@/lib/earnings-api');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));
vi.mock('next/dynamic', () => ({
  default: (fn: any) => {
    const Component = vi.fn(() => <div>Chart</div>);
    if (fn.loading) Component.loading = fn.loading;
    return Component;
  },
  Suspense: ({ children }: any) => children,
}));
vi.mock('@/components/earnings', () => ({
  EarningsSummaryCard: () => <div>Earnings Summary</div>,
  EarningsChartSkeleton: () => <div>Loading Chart</div>,
}));
vi.mock('@/components/dashboard', () => ({
  DashboardSectionBoundary: ({ children, label }: any) => (
    <div data-testid={`section-${label}`}>{children}</div>
  ),
}));

describe('DashboardEarningsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while checking authentication', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: false,
      sessionData: null,
      isLoading: true,
      hasStoredSession: false,
      validationError: null,
    });

    render(<DashboardEarningsPage />);
    expect(screen.getByTestId('section-Earnings summary')).toBeInTheDocument();
  });

  it('shows error message for unauthenticated users', async () => {
    const pushMock = vi.fn();
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: false,
      sessionData: null,
      isLoading: false,
      hasStoredSession: false,
      validationError: null,
    });

    render(<DashboardEarningsPage />);

    await waitFor(() => {
      expect(screen.getByText(/must be logged in/i)).toBeInTheDocument();
    });
  });

  it('shows error for non-creators', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      sessionData: {
        id: 'user-1',
        email: 'test@example.com',
        is_creator: false,
        username: 'testuser',
        display_name: null,
        avatar_url: null,
        website_url: null,
        x_handle: null,
        instagram_handle: null,
        other_url: null,
        creator: null,
      },
      isLoading: false,
      hasStoredSession: true,
      validationError: null,
    });

    render(<DashboardEarningsPage />);

    expect(screen.getByText(/only creators can view earnings/i)).toBeInTheDocument();
  });

  it('renders dashboard earnings for authenticated creators', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      sessionData: {
        id: 'creator-1',
        email: 'creator@example.com',
        is_creator: true,
        username: 'creator',
        display_name: 'Creator Name',
        avatar_url: null,
        website_url: null,
        x_handle: null,
        instagram_handle: null,
        other_url: null,
        creator: {
          id: 'creator-1',
          bio: 'Test creator',
          subscription_price: '10',
          currency: 'XLM',
          banner_url: null,
          is_verified: false,
          followers_count: 100,
        },
      },
      isLoading: false,
      hasStoredSession: true,
      validationError: null,
    });

    render(<DashboardEarningsPage />);

    await waitFor(() => {
      expect(screen.getByText('Earnings')).toBeInTheDocument();
      expect(screen.getByTestId('section-Earnings summary')).toBeInTheDocument();
    });
  });

  it('displays withdrawal CTA that links to full earnings page', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      sessionData: {
        id: 'creator-1',
        email: 'creator@example.com',
        is_creator: true,
        username: 'creator',
        display_name: null,
        avatar_url: null,
        website_url: null,
        x_handle: null,
        instagram_handle: null,
        other_url: null,
        creator: {
          id: 'creator-1',
          bio: null,
          subscription_price: '10',
          currency: 'XLM',
          banner_url: null,
          is_verified: false,
          followers_count: 0,
        },
      },
      isLoading: false,
      hasStoredSession: true,
      validationError: null,
    });

    render(<DashboardEarningsPage />);

    await waitFor(() => {
      const withdrawLink = screen.getByRole('link', { name: /go to earnings/i });
      expect(withdrawLink).toHaveAttribute('href', '/earnings');
    });
  });

  it('displays period selector for different date ranges', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      sessionData: {
        id: 'creator-1',
        email: 'creator@example.com',
        is_creator: true,
        username: 'creator',
        display_name: null,
        avatar_url: null,
        website_url: null,
        x_handle: null,
        instagram_handle: null,
        other_url: null,
        creator: {
          id: 'creator-1',
          bio: null,
          subscription_price: '10',
          currency: 'XLM',
          banner_url: null,
          is_verified: false,
          followers_count: 0,
        },
      },
      isLoading: false,
      hasStoredSession: true,
      validationError: null,
    });

    render(<DashboardEarningsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /7d/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30d/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90d/i })).toBeInTheDocument();
    });
  });

  it('enforces creator-only authorization', () => {
    const scenarios = [
      { is_creator: false, shouldShowError: true },
      { is_creator: true, shouldShowError: false },
    ];

    scenarios.forEach(({ is_creator, shouldShowError }) => {
      vi.clearAllMocks();
      vi.mocked(authHooks.useAuth).mockReturnValue({
        isAuthenticated: is_creator || false,
        sessionData: is_creator
          ? {
              id: 'creator-1',
              email: 'creator@example.com',
              is_creator: true,
              username: 'creator',
              display_name: null,
              avatar_url: null,
              website_url: null,
              x_handle: null,
              instagram_handle: null,
              other_url: null,
              creator: {
                id: 'creator-1',
                bio: null,
                subscription_price: '10',
                currency: 'XLM',
                banner_url: null,
                is_verified: false,
                followers_count: 0,
              },
            }
          : {
              id: 'user-1',
              email: 'user@example.com',
              is_creator: false,
              username: 'user',
              display_name: null,
              avatar_url: null,
              website_url: null,
              x_handle: null,
              instagram_handle: null,
              other_url: null,
              creator: null,
            },
        isLoading: false,
        hasStoredSession: true,
        validationError: null,
      });

      const { unmount } = render(<DashboardEarningsPage />);

      if (shouldShowError) {
        expect(screen.getByText(/only creators can view/i)).toBeInTheDocument();
      } else {
        expect(screen.getByText('Earnings')).toBeInTheDocument();
      }

      unmount();
    });
  });
});

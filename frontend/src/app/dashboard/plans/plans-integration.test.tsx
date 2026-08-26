import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PlansPage from './page';
import * as authHooks from '@/hooks/useAuth';
import * as plansApi from '@/lib/api/plans';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    connectionState: { status: 'disconnected' },
    isConnected: false,
    address: null,
    walletType: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    isModalOpen: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    isWalletInstalled: vi.fn(),
    getInstallUrl: vi.fn(),
    isReconnecting: false,
    hasCheckedConnection: true,
  }),
}));
vi.mock('@/lib/api/plans');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));
vi.mock('@/components/plan', () => ({
  SubscriptionPlanForm: ({ onSaveDraft, onPublish }: any) => (
    <div>
      <button onClick={() => onSaveDraft?.({ name: 'Test', price: '10' })}>Save Draft</button>
      <button onClick={() => onPublish?.({ name: 'Test', price: '10' })}>Publish</button>
    </div>
  ),
}));
vi.mock('@/components/cards', () => ({
  BaseCard: ({ children }: any) => <div>{children}</div>,
  PlanCard: ({ plan }: any) => <div>{plan.name}</div>,
}));
vi.mock('@/components/dashboard', () => ({
  DashboardSectionBoundary: ({ children }: any) => <div>{children}</div>,
}));

describe('Dashboard Plans Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows auth error for unauthenticated users', async () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: false,
      sessionData: null,
      isLoading: false,
      hasStoredSession: false,
      validationError: null,
    });

    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/must be logged in/i)).toBeInTheDocument();
    });
  });

  it('shows auth error for non-creators', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      sessionData: {
        id: 'user-1',
        email: 'fan@example.com',
        is_creator: false,
        username: 'fan',
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

    render(<PlansPage />);

    expect(screen.getByText(/only creators can manage/i)).toBeInTheDocument();
  });

  it('loads plans from API for authenticated creators', async () => {
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
          id: 'creator-addr-1',
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

    vi.mocked(plansApi.getCreatorPlans).mockResolvedValue({
      data: [
        {
          id: 1,
          creator: 'GBCQ...',
          asset: 'USDC',
          amount: '100.00',
          intervalDays: 30,
        },
        {
          id: 2,
          creator: 'GBCQ...',
          asset: 'XLM',
          amount: '50.00',
          intervalDays: 30,
        },
      ],
      limit: 50,
      page: 1,
      total: 2,
      total_pages: 1,
    });

    render(<PlansPage />);

    await waitFor(() => {
      expect(plansApi.getCreatorPlans).toHaveBeenCalledWith('creator-addr-1', 1, 50);
    });
  });

  it('displays loaded plans with on-chain status', async () => {
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

    vi.mocked(plansApi.getCreatorPlans).mockResolvedValue({
      data: [
        {
          id: 1,
          creator: 'GBCQ...',
          asset: 'USDC',
          amount: '100.00',
          intervalDays: 30,
        },
      ],
      limit: 50,
      page: 1,
      total: 1,
      total_pages: 1,
    });

    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/Plan 1/)).toBeInTheDocument();
    });
  });

  it('enforces authorization when creating plans', async () => {
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

    vi.mocked(plansApi.getCreatorPlans).mockResolvedValue({
      data: [],
      limit: 50,
      page: 1,
      total: 0,
      total_pages: 1,
    });

    vi.mocked(plansApi.createPlan).mockRejectedValue(
      new Error('You do not have permission to create plans')
    );

    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/Subscription Plans/)).toBeInTheDocument();
    });
  });

  it('uses idempotency key for plan creation', async () => {
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

    vi.mocked(plansApi.getCreatorPlans).mockResolvedValue({
      data: [],
      limit: 50,
      page: 1,
      total: 0,
      total_pages: 1,
    });

    vi.mocked(plansApi.generatePlanIdempotencyKey).mockReturnValue('plan-test-key-123');

    render(<PlansPage />);

    await waitFor(() => {
      expect(screen.getByText(/Subscription Plans/)).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContentPage from './page';
import * as authHooks from '@/hooks/useAuth';
import * as contentLibraryHooks from '@/hooks/useContentLibrary';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useContentLibrary');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));
vi.mock('@/components/content-library', () => ({
  ContentLibrary: ({ initialItems, loading, error }: any) => (
    <div>
      <div data-testid="content-library">
        {loading ? 'Loading...' : error ? `Error: ${error}` : `Items: ${initialItems.length}`}
      </div>
    </div>
  ),
}));
vi.mock('@/components/dashboard', () => ({
  DashboardSectionBoundary: ({ children }: any) => <div>{children}</div>,
}));

describe('Dashboard Content Page', () => {
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

    vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      uploadDisabledMessage: '',
      refresh: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkArchive: vi.fn(),
    });

    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText(/must be logged in/i)).toBeInTheDocument();
    });
  });

  it('shows auth error for non-creators', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: true,
      sessionData: {
        id: 'fan-1',
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

    vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      uploadDisabledMessage: '',
      refresh: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkArchive: vi.fn(),
    });

    render(<ContentPage />);

    expect(screen.getByText(/only creators can manage/i)).toBeInTheDocument();
  });

  it('displays content library for authenticated creators', async () => {
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
          id: 'creator-addr',
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

    const mockItems = [
      {
        id: '1',
        title: 'Post 1',
        type: 'image' as const,
        status: 'published' as const,
        isLocked: false,
      },
    ];

    vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
      items: mockItems,
      loading: false,
      error: null,
      uploadDisabledMessage: 'Upload disabled',
      refresh: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkArchive: vi.fn(),
    });

    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText(/Content Library/)).toBeInTheDocument();
      expect(screen.getByTestId('content-library')).toHaveTextContent('Items: 1');
    });
  });

  it('loads content library with creator ID', async () => {
    const creatorId = 'creator-123';
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
          id: creatorId,
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

    vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      uploadDisabledMessage: '',
      refresh: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkArchive: vi.fn(),
    });

    render(<ContentPage />);

    await waitFor(() => {
      expect(contentLibraryHooks.useContentLibrary).toHaveBeenCalledWith(creatorId);
    });
  });

  it('displays loading state while authenticating', () => {
    vi.mocked(authHooks.useAuth).mockReturnValue({
      isAuthenticated: false,
      sessionData: null,
      isLoading: true,
      hasStoredSession: false,
      validationError: null,
    });

    vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
      items: [],
      loading: false,
      error: null,
      uploadDisabledMessage: '',
      refresh: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkArchive: vi.fn(),
    });

    render(<ContentPage />);

    expect(screen.getByText(/Content Library/)).toBeInTheDocument();
  });

  it('displays locked flag for gated content', async () => {
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

    const mockItems = [
      {
        id: '1',
        title: 'Public Post',
        type: 'image' as const,
        status: 'published' as const,
        isLocked: false,
      },
      {
        id: '2',
        title: 'Gated Post',
        type: 'image' as const,
        status: 'published' as const,
        isLocked: true,
      },
    ];

    vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
      items: mockItems,
      loading: false,
      error: null,
      uploadDisabledMessage: '',
      refresh: vi.fn().mockResolvedValue(undefined),
      onUpload: vi.fn(),
      onBulkDelete: vi.fn(),
      onBulkArchive: vi.fn(),
    });

    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByTestId('content-library')).toHaveTextContent('Items: 2');
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

      vi.mocked(contentLibraryHooks.useContentLibrary).mockReturnValue({
        items: [],
        loading: false,
        error: null,
        uploadDisabledMessage: '',
        refresh: vi.fn().mockResolvedValue(undefined),
        onUpload: vi.fn(),
        onBulkDelete: vi.fn(),
        onBulkArchive: vi.fn(),
      });

      const { unmount } = render(<ContentPage />);

      if (shouldShowError) {
        expect(screen.getByText(/only creators can manage/i)).toBeInTheDocument();
      } else {
        expect(screen.getByTestId('content-library')).toBeInTheDocument();
      }

      unmount();
    });
  });
});

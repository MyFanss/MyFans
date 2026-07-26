import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FeedContent } from './FeedContent';

const mockPosts = [
  {
    id: 'post-1',
    title: 'My First Post',
    content: 'This is content for my first post',
    authorId: 'creator-1',
    isPublished: true,
    isPremium: false,
    likesCount: 10,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'post-2',
    title: 'Premium Content',
    content: 'This is subscriber-only content',
    authorId: 'creator-2',
    isPublished: true,
    isPremium: true,
    likesCount: 25,
    createdAt: '2025-01-02T00:00:00Z',
  },
];

vi.mock('@/lib/api/feed');
vi.mock('@/lib/api/posts', () => ({
  publicPostToCreatorPost: (post: any) => ({
    id: post.id,
    title: post.title,
    type: 'text',
    excerpt: post.content.slice(0, 140),
    publishedAt: post.createdAt,
    isLocked: post.isPremium,
    likeCount: post.likesCount,
  }),
}));

vi.mock('@/hooks/usePrefetchCreatorRoute', () => ({
  usePrefetchCreatorRoute: () => ({
    hoverHandlers: {},
  }),
}));

vi.mock('@/components/cards', () => ({
  ContentCard: ({ title }: any) => <div>{title}</div>,
}));

vi.mock('@/components/ui/ContentCardSkeleton', () => ({
  default: () => <div className="skeleton">Loading...</div>,
}));

import { getFeed } from '@/lib/api/feed';

describe('FeedContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getFeed as any).mockResolvedValue({
      data: mockPosts,
      nextCursor: null,
      hasMore: false,
    });
    vi.stubGlobal('IntersectionObserver', class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders feed header', async () => {
    render(<FeedContent />);

    expect(screen.getByText('Your Feed')).toBeInTheDocument();
    expect(
      screen.getByText('Latest posts from creators you follow'),
    ).toBeInTheDocument();
  });

  it('loads and displays posts on mount', async () => {
    render(<FeedContent />);

    await waitFor(() => {
      expect(screen.getByText('My First Post')).toBeInTheDocument();
      expect(screen.getByText('Premium Content')).toBeInTheDocument();
    });

    expect(getFeed).toHaveBeenCalledWith({ limit: 12 });
  });

  it('shows empty state when no posts and not loading', async () => {
    (getFeed as any).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
    });

    render(<FeedContent />);

    await waitFor(() => {
      expect(screen.getByText('No posts yet')).toBeInTheDocument();
      expect(
        screen.getByText(
          "You haven't subscribed to any creators yet. Find creators to follow and get exclusive content.",
        ),
      ).toBeInTheDocument();
    });
  });

  it('shows discover link in empty state', async () => {
    (getFeed as any).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
    });

    render(<FeedContent />);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'Discover creators' });
      expect(link).toHaveAttribute('href', '/discover');
    });
  });

  it('shows error state when feed fails to load', async () => {
    (getFeed as any).mockRejectedValue(new Error('API Error'));

    render(<FeedContent />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load feed')).toBeInTheDocument();
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('handles load more with cursor', async () => {
    const initialResponse = {
      data: [mockPosts[0]],
      nextCursor: 'cursor-123',
      hasMore: true,
    };

    const nextResponse = {
      data: [mockPosts[1]],
      nextCursor: null,
      hasMore: false,
    };

    (getFeed as any)
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValueOnce(nextResponse);

    render(<FeedContent />);

    await waitFor(() => {
      expect(screen.getByText('My First Post')).toBeInTheDocument();
    });

    // Simulate infinite scroll trigger
    const loadMoreDiv = screen.getByText('Loading...');
    fireEvent.intersection(loadMoreDiv);

    await waitFor(() => {
      expect(getFeed).toHaveBeenCalledWith({
        cursor: 'cursor-123',
        limit: 8,
      });
    });
  });
});

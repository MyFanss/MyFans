import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientContent } from './client-content';
import type { ContentMetadata } from '@/lib/api/content';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/api/content', () => ({
  getContentAccess: vi.fn(),
}));

vi.mock('@/lib/api/likes', () => ({
  getPostLikeStatus: vi.fn(),
  getPostLikeCount: vi.fn(),
  togglePostLike: vi.fn(),
}));

// Lightweight stand-in so we can assert on the gate props without pulling
// in the full viewer (toast context, next/image, etc.).
vi.mock('@/components/GatedContentViewer', () => ({
  GatedContentViewer: (props: {
    isGated: boolean;
    isSubscribed: boolean;
    canInteract?: boolean;
    contentUrl?: string;
    liked?: boolean;
    onLike?: (liked: boolean) => Promise<void>;
  }) => (
    <div
      data-testid="viewer"
      data-gated={String(props.isGated)}
      data-subscribed={String(props.isSubscribed)}
      data-can-interact={String(props.canInteract)}
    >
      {props.isSubscribed ? (
        <>
          <span data-testid="media">{props.contentUrl}</span>
          <button
            type="button"
            data-testid="like-button"
            data-liked={String(Boolean(props.liked))}
            disabled={!props.canInteract}
            onClick={() => void props.onLike?.(!Boolean(props.liked))}
          >
            {Boolean(props.liked) ? 'liked' : 'not-liked'}
          </button>
        </>
      ) : (
        <span data-testid="teaser">locked</span>
      )}
    </div>
  ),
}));

vi.mock('@/components/subscription/SubscriptionStatusBadge', () => ({
  SubscriptionStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="badge">{status}</span>
  ),
}));

vi.mock('./content-comments', () => ({
  ContentComments: ({ contentId }: { contentId: string }) => (
    <div data-testid="comments">comments for {contentId}</div>
  ),
}));

import { getContentAccess } from '@/lib/api/content';
import {
  getPostLikeStatus,
  getPostLikeCount,
  togglePostLike,
} from '@/lib/api/likes';

const baseContent: ContentMetadata = {
  id: 'c-1',
  title: 'Behind the scenes',
  description: 'Exclusive footage.',
  contentUrl: 'https://ipfs.example/QmHash',
  thumbnailUrl: 'https://cdn.example/thumb.jpg',
  type: 'video',
  isGated: true,
  creator: {
    id: 'creator-1',
    name: 'Jamie Rivera',
    username: 'jamierivera',
    isVerified: true,
  },
  metadata: {
    publishedAt: '2026-01-01T00:00:00.000Z',
    viewCount: 10,
    likeCount: 2,
    commentCount: 4,
    tags: [],
  },
};

describe('ClientContent gating', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getContentAccess).mockReset();
    vi.mocked(getPostLikeStatus).mockReset();
    vi.mocked(getPostLikeCount).mockReset();
    vi.mocked(togglePostLike).mockReset();
    push.mockReset();
  });
  afterEach(() => {
    (globalThis as { fetch?: unknown }).fetch = undefined;
  });

  it('shows the teaser and hides comments/interactions while access is denied', async () => {
    vi.mocked(getContentAccess).mockResolvedValue({
      hasAccess: false,
      reason: 'subscription_required',
    });

    render(<ClientContent content={baseContent} />);

    await waitFor(() =>
      expect(screen.getByTestId('viewer')).toHaveAttribute('data-subscribed', 'false'),
    );
    expect(screen.getByTestId('teaser')).toBeInTheDocument();
    expect(screen.queryByTestId('media')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comments')).not.toBeInTheDocument();
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-can-interact', 'false');
  });

  it('reveals full media + comments once the access API grants access', async () => {
    vi.mocked(getContentAccess).mockResolvedValue({ hasAccess: true, reason: 'granted' });

    render(<ClientContent content={baseContent} />);

    await waitFor(() => expect(screen.getByTestId('comments')).toBeInTheDocument());
    expect(screen.getByTestId('media')).toHaveTextContent('https://ipfs.example/QmHash');
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-can-interact', 'true');
  });

  it('does not call the access API for un-gated content', async () => {
    render(<ClientContent content={{ ...baseContent, isGated: false, locked: false }} />);

    await waitFor(() => expect(screen.getByTestId('comments')).toBeInTheDocument());
    expect(getContentAccess).not.toHaveBeenCalled();
  });

  it('honors an inline locked flag even when isGated is false', async () => {
    vi.mocked(getContentAccess).mockResolvedValue({
      hasAccess: false,
      reason: 'subscription_required',
    });

    render(
      <ClientContent content={{ ...baseContent, isGated: false, locked: true }} />,
    );

    await waitFor(() => expect(getContentAccess).toHaveBeenCalledWith('c-1'));
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-gated', 'true');
    expect(screen.queryByTestId('comments')).not.toBeInTheDocument();
  });

  it('routes the subscribe CTA to the real subscribe flow (no client unlock)', async () => {
    vi.mocked(getContentAccess).mockResolvedValue({
      hasAccess: false,
      reason: 'subscription_required',
    });

    render(<ClientContent content={baseContent} />);

    const cta = await screen.findByRole('button');
    cta.click();
    expect(push).toHaveBeenCalledWith('/subscribe/creator-1');
    // Still locked — nothing flipped client-side.
    expect(screen.getByTestId('viewer')).toHaveAttribute('data-subscribed', 'false');
  });

  it('loads server like state and posts the toggle for unlocked content', async () => {
    vi.mocked(getContentAccess).mockResolvedValue({ hasAccess: true, reason: 'granted' });
    vi.mocked(getPostLikeStatus).mockResolvedValue(true);
    vi.mocked(getPostLikeCount).mockResolvedValue(12);
    vi.mocked(togglePostLike).mockResolvedValue({ liked: false, count: 11 });

    render(<ClientContent content={baseContent} />);

    await waitFor(() => expect(getPostLikeStatus).toHaveBeenCalledWith('c-1'));
    await waitFor(() => expect(getPostLikeCount).toHaveBeenCalledWith('c-1'));

    const viewer = screen.getByTestId('viewer');
    expect(viewer).toHaveAttribute('data-can-interact', 'true');

    await waitFor(() => expect(screen.getByTestId('like-button')).toHaveAttribute('data-liked', 'true'));

    await userEvent.click(screen.getByTestId('like-button'));
    await waitFor(() => expect(togglePostLike).toHaveBeenCalledWith('c-1', false));
  });

  it('redirects unauthenticated users when the server rejects a like', async () => {
    vi.mocked(getContentAccess).mockResolvedValue({ hasAccess: true, reason: 'granted' });
    vi.mocked(getPostLikeStatus).mockResolvedValue(false);
    vi.mocked(getPostLikeCount).mockResolvedValue(9);
    vi.mocked(togglePostLike).mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));

    render(<ClientContent content={baseContent} />);

    await waitFor(() => expect(getPostLikeStatus).toHaveBeenCalledWith('c-1'));

    const viewer = screen.getByTestId('viewer');
    expect(viewer).toHaveAttribute('data-can-interact', 'true');

    const button = screen.getByTestId('like-button');
    await userEvent.click(button);

    await vi.waitFor(() => {
      expect(push).toHaveBeenCalledWith('/auth/sign-in?redirectTo=%2Fcontent%2Fc-1');
    });
  });
});

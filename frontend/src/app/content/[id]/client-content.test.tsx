import { render, screen, waitFor } from '@testing-library/react';
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

// Lightweight stand-in so we can assert on the gate props without pulling
// in the full viewer (toast context, next/image, etc.).
vi.mock('@/components/GatedContentViewer', () => ({
  GatedContentViewer: (props: {
    isGated: boolean;
    isSubscribed: boolean;
    canInteract?: boolean;
    contentUrl?: string;
  }) => (
    <div
      data-testid="viewer"
      data-gated={String(props.isGated)}
      data-subscribed={String(props.isSubscribed)}
      data-can-interact={String(props.canInteract)}
    >
      {props.isSubscribed ? (
        <span data-testid="media">{props.contentUrl}</span>
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
});

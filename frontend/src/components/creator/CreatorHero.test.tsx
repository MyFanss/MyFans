/* eslint-disable @next/next/no-img-element */
import type { ComponentProps, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreatorHero } from '@/components/creator/CreatorHero';
import type { CreatorProfile } from '@/lib/creator-profile';

vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'> & { fill?: boolean; priority?: boolean }) => {
    const sanitizedProps = { ...props };
    delete sanitizedProps.fill;
    delete sanitizedProps.priority;

    return <img {...sanitizedProps} alt={props.alt ?? ''} />;
  },
}));

vi.mock('@/components/BookmarkButton', () => ({
  BookmarkButton: ({ creatorId }: { creatorId: string }) => (
    <button type="button">Bookmark {creatorId}</button>
  ),
}));

vi.mock('@/components/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const creator: CreatorProfile = {
  id: 'creator-1',
  username: 'maria',
  displayName: 'Maria Garcia',
  bio: 'Singer-songwriter sharing original music and behind-the-scenes content.',
  subscriberCount: 45200,
  subscriptionPrice: 7.99,
  isVerified: true,
  categories: ['Music', 'Entertainment'],
  avatarUrl: '/placeholder-3.jpg',
  socialLinks: [
    {
      platform: 'twitter',
      url: 'https://twitter.com/mariagarcia',
      label: 'Twitter',
    },
  ],
};

describe('CreatorHero', () => {
  it('shows the viewer subscription badge and helper copy on creator profiles', () => {
    render(
      <CreatorHero
        creator={creator}
        viewerSubscriptionStatus="cancelled"
      />,
    );

    expect(
      screen.getByRole('status', { name: 'Subscription status: cancelled' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your subscription was cancelled. Subscribe again to restore access.'),
    ).toBeInTheDocument();
  });

  it('does not render a subscription badge when the viewer has no creator status', () => {
    render(<CreatorHero creator={creator} viewerSubscriptionStatus={null} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

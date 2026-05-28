/* eslint-disable @next/next/no-img-element */
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentCard } from '@/components/cards/ContentCard';

// Mock next/image as a plain <img> so onLoad can be fired via fireEvent
vi.mock('next/image', () => ({
  default: ({ onLoad, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean }) => {
    const sanitizedProps = { ...props } as Record<string, unknown>;
    delete sanitizedProps.fill;
    delete sanitizedProps.priority;
    return <img {...(sanitizedProps as ComponentProps<'img'>)} onLoad={onLoad} alt={props.alt ?? ''} />;
  },
}));

const baseProps = {
  title: 'Test Content',
  type: 'image' as const,
};

describe('ContentCard – lazy-load thumbnail skeleton', () => {
  it('renders a shimmer skeleton before the thumbnail loads', () => {
    render(<ContentCard {...baseProps} thumbnailUrl="/test.jpg" />);

    // The skeleton is aria-hidden; query by role=none / aria-hidden element
    // Alternatively, the img should be opacity-0 (class check)
    const img = screen.getByRole('img', { name: 'Test Content' });
    expect(img).toHaveClass('opacity-0');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('hides the skeleton after the thumbnail image fires onLoad', () => {
    render(<ContentCard {...baseProps} thumbnailUrl="/test.jpg" />);

    const img = screen.getByRole('img', { name: 'Test Content' });
    expect(img).toHaveClass('opacity-0');

    fireEvent.load(img);

    expect(img).toHaveClass('opacity-100');
    // The skeleton div (aria-hidden) should no longer be in the DOM
    const skeletons = document.querySelectorAll('[aria-hidden="true"]');
    // After load, thumbnail skeleton should be gone; only skeletons from
    // other areas may remain (there are none when no avatar is provided)
    expect(skeletons).toHaveLength(0);
  });

  it('does not render a thumbnail or skeleton when thumbnailUrl is absent', () => {
    render(<ContentCard {...baseProps} />);

    // No image, no skeleton
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('thumbnail image has loading="lazy" attribute', () => {
    render(<ContentCard {...baseProps} thumbnailUrl="/lazy.jpg" />);

    expect(screen.getByRole('img', { name: 'Test Content' })).toHaveAttribute('loading', 'lazy');
  });
});

describe('ContentCard – lazy-load creator avatar skeleton', () => {
  it('renders avatar skeleton before creator avatar loads', () => {
    render(
      <ContentCard
        {...baseProps}
        creatorName="Jane Doe"
        creatorAvatar="/avatar.jpg"
      />,
    );

    const avatarImg = screen.getByRole('img', { name: 'Jane Doe' });
    expect(avatarImg).toHaveClass('opacity-0');
    expect(avatarImg).toHaveAttribute('loading', 'lazy');
  });

  it('hides avatar skeleton after avatar fires onLoad', () => {
    render(
      <ContentCard
        {...baseProps}
        creatorName="Jane Doe"
        creatorAvatar="/avatar.jpg"
      />,
    );

    const avatarImg = screen.getByRole('img', { name: 'Jane Doe' });
    expect(avatarImg).toHaveClass('opacity-0');

    fireEvent.load(avatarImg);

    expect(avatarImg).toHaveClass('opacity-100');
  });

  it('renders initials fallback (no image, no skeleton) when creatorAvatar is absent', () => {
    render(<ContentCard {...baseProps} creatorName="Jane Doe" />);

    expect(screen.queryByRole('img', { name: 'Jane Doe' })).toBeNull();
    expect(screen.getByText('J')).toBeInTheDocument();
  });
});

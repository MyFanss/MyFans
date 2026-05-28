/* eslint-disable @next/next/no-img-element */
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreatorCard } from '@/components/cards/CreatorCard';

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
  name: 'Jane Doe',
  username: 'janedoe',
};

describe('CreatorCard – lazy-load avatar skeleton', () => {
  it('renders a shimmer skeleton before the avatar loads', () => {
    render(<CreatorCard {...baseProps} avatarUrl="/avatar.jpg" />);

    const img = screen.getByRole('img', { name: 'Jane Doe' });
    expect(img).toHaveClass('opacity-0');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('removes the skeleton after avatar fires onLoad', () => {
    render(<CreatorCard {...baseProps} avatarUrl="/avatar.jpg" />);

    const img = screen.getByRole('img', { name: 'Jane Doe' });
    expect(img).toHaveClass('opacity-0');

    fireEvent.load(img);

    expect(img).toHaveClass('opacity-100');
    // Skeleton element (aria-hidden) should be gone
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('renders initials fallback when avatarUrl is absent (no img, no skeleton)', () => {
    render(<CreatorCard {...baseProps} />);

    expect(screen.queryByRole('img')).toBeNull();
    // First character of name used as initials
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('avatar image has loading="lazy" attribute', () => {
    render(<CreatorCard {...baseProps} avatarUrl="/lazy-avatar.jpg" />);

    expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute('loading', 'lazy');
  });

  it('correct image dimensions are passed to the avatar', () => {
    render(<CreatorCard {...baseProps} avatarUrl="/avatar.jpg" />);

    const img = screen.getByRole('img', { name: 'Jane Doe' });
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });
});

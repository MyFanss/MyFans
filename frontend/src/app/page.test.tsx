import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from './page';

// Mirrors the next/link mock in DashboardNav.test.tsx: render a plain <a>
// without the Next.js router.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('HomePage', () => {
  it('renders the MyFans heading', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'MyFans' })).toBeInTheDocument();
  });

  it('links to the public discover page', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: /discover creators/i })).toHaveAttribute(
      'href',
      '/discover',
    );
  });

  it('links to sign-in', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/auth/sign-in',
    );
  });
});

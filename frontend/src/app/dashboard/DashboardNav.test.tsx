/**
 * Unit tests for DashboardNav — asserts active link highlighting and
 * aria-current="page" for each of the four dashboard routes.
 *
 * Closes #1975.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardNav, { navLinks } from './DashboardNav';

// Mock next/link so it renders a plain <a> without the Next.js router.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Mock usePathname so we can control the active route.
const mockUsePathname = vi.fn<() => string>();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('DashboardNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all four nav links', () => {
    mockUsePathname.mockReturnValue('/dashboard/plans');
    render(<DashboardNav />);

    for (const { label } of navLinks) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('marks the Plans link with aria-current="page" when pathname is /dashboard/plans', () => {
    mockUsePathname.mockReturnValue('/dashboard/plans');
    render(<DashboardNav />);

    expect(screen.getByText('Plans').closest('a')?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Content').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Subscribers').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Earnings').closest('a')?.getAttribute('aria-current')).toBeNull();
  });

  it('marks the Content link with aria-current="page" when pathname is /dashboard/content', () => {
    mockUsePathname.mockReturnValue('/dashboard/content');
    render(<DashboardNav />);

    expect(screen.getByText('Content').closest('a')?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Plans').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Subscribers').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Earnings').closest('a')?.getAttribute('aria-current')).toBeNull();
  });

  it('marks the Subscribers link with aria-current="page" when pathname is /dashboard/subscribers', () => {
    mockUsePathname.mockReturnValue('/dashboard/subscribers');
    render(<DashboardNav />);

    expect(screen.getByText('Subscribers').closest('a')?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Plans').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Content').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Earnings').closest('a')?.getAttribute('aria-current')).toBeNull();
  });

  it('marks the Earnings link with aria-current="page" when pathname is /dashboard/earnings', () => {
    mockUsePathname.mockReturnValue('/dashboard/earnings');
    render(<DashboardNav />);

    expect(screen.getByText('Earnings').closest('a')?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Plans').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Content').closest('a')?.getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Subscribers').closest('a')?.getAttribute('aria-current')).toBeNull();
  });

  it('active link has a visually distinct style (background set)', () => {
    mockUsePathname.mockReturnValue('/dashboard/plans');
    render(<DashboardNav />);

    const activeLink = screen.getByText('Plans').closest('a');
    const inactiveLink = screen.getByText('Content').closest('a');

    // The active link must have a background color in its style.
    const activeStyle = (activeLink as HTMLElement | null)?.getAttribute('style') ?? '';
    const inactiveStyle = (inactiveLink as HTMLElement | null)?.getAttribute('style') ?? '';

    expect(activeStyle).toContain('background');
    // Inactive link should not have the active background color.
    expect(inactiveStyle).not.toContain('1e1e40');
  });
});

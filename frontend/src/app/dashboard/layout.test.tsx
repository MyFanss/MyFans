import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardLayout from './layout';

let mockPathname = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/components/onboarding', () => ({
  OnboardingResumeBanner: () => null,
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DashboardLayout accessibility', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    localStorage.clear();
  });

  it('renders a skip link pointing at the main content landmark', () => {
    render(
      <DashboardLayout>
        <p>page content</p>
      </DashboardLayout>,
    );

    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink.getAttribute('href')).toBe('#dashboard-main');
  });

  it('gives the main landmark a focusable id matching the skip link target', () => {
    render(
      <DashboardLayout>
        <p>page content</p>
      </DashboardLayout>,
    );

    const main = document.getElementById('dashboard-main');
    expect(main).not.toBeNull();
    expect(main?.tagName).toBe('MAIN');
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });

  it('moves focus to main content when the route changes', () => {
    const { rerender } = render(
      <DashboardLayout>
        <p>page content</p>
      </DashboardLayout>,
    );

    const main = document.getElementById('dashboard-main');
    expect(main).not.toBe(document.activeElement);

    mockPathname = '/dashboard/plans';
    rerender(
      <DashboardLayout>
        <p>plans content</p>
      </DashboardLayout>,
    );

    expect(document.getElementById('dashboard-main')).toBe(document.activeElement);
  });

  it('labels icon-only buttons for screen readers', () => {
    render(
      <DashboardLayout>
        <p>page content</p>
      </DashboardLayout>,
    );

    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
  });
});

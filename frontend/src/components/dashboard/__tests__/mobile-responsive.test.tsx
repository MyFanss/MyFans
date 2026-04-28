/**
 * Mobile responsiveness tests for creator dashboard components.
 * Covers: SubscribersTable mobile cards, QuickActions touch targets,
 * DashboardHome metric grid layout.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// ── SubscribersTable ──────────────────────────────────────────────────────────
import SubscribersTable from '../SubscribersTable';

describe('SubscribersTable – mobile card view', () => {
  it('renders mobile card container', () => {
    render(<SubscribersTable />);
    // The mobile card section uses md:hidden; it is always in the DOM.
    const mobileSection = document.querySelector('.md\\:hidden');
    expect(mobileSection).not.toBeNull();
  });

  it('renders subscriber names in mobile cards', () => {
    render(<SubscribersTable />);
    // The mobile card section should contain at least one subscriber name.
    // Default sort is joinDate desc; Kevin Hart (2023-06-25) is on page 1.
    const mobileSection = document.querySelector('.md\\:hidden')!;
    expect(mobileSection.textContent).toMatch(/Kevin Hart|Evan Davis|Fiona Gallagher|Julia Roberts|George Miller/);
  });

  it('mobile cards include plan and total-paid labels', () => {
    render(<SubscribersTable />);
    // Labels rendered inside mobile cards
    const planLabels = screen.getAllByText('Plan');
    const paidLabels = screen.getAllByText('Total Paid');
    expect(planLabels.length).toBeGreaterThan(0);
    expect(paidLabels.length).toBeGreaterThan(0);
  });

  it('pagination previous button has min touch-target classes', () => {
    render(<SubscribersTable />);
    const prevBtn = screen.getByRole('button', { name: /previous page/i });
    // Tailwind classes for 44px touch target on mobile
    expect(prevBtn.className).toMatch(/min-w-\[44px\]/);
    expect(prevBtn.className).toMatch(/min-h-\[44px\]/);
  });

  it('pagination next button has min touch-target classes', () => {
    render(<SubscribersTable />);
    const nextBtn = screen.getByRole('button', { name: /next page/i });
    expect(nextBtn.className).toMatch(/min-w-\[44px\]/);
    expect(nextBtn.className).toMatch(/min-h-\[44px\]/);
  });

  it('desktop table is hidden on mobile via hidden md:block', () => {
    render(<SubscribersTable />);
    const desktopTable = document.querySelector('.hidden.md\\:block');
    expect(desktopTable).not.toBeNull();
  });
});

// ── QuickActions ──────────────────────────────────────────────────────────────
import { QuickActions } from '../QuickActions';

const mockActions = [
  { id: 'plan', label: 'Create plan', description: 'New subscription plan', onClick: vi.fn(), icon: <span>📋</span> },
  { id: 'upload', label: 'Upload content', description: 'Publish new content', onClick: vi.fn(), icon: <span>📤</span> },
];

describe('QuickActions – touch targets', () => {
  it('renders all action buttons', () => {
    render(<QuickActions actions={mockActions} />);
    expect(screen.getByRole('button', { name: /create plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload content/i })).toBeInTheDocument();
  });

  it('action buttons have min-h-[60px] for touch target compliance', () => {
    render(<QuickActions actions={mockActions} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toMatch(/min-h-\[60px\]/);
    });
  });

  it('action buttons have touch-manipulation class', () => {
    render(<QuickActions actions={mockActions} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.className).toMatch(/touch-manipulation/);
    });
  });

  it('renders single-column grid (no multi-column on mobile)', () => {
    render(<QuickActions actions={mockActions} />);
    const grid = document.querySelector('.grid.grid-cols-1');
    expect(grid).not.toBeNull();
  });

  it('renders action descriptions', () => {
    render(<QuickActions actions={mockActions} />);
    expect(screen.getByText('New subscription plan')).toBeInTheDocument();
    expect(screen.getByText('Publish new content')).toBeInTheDocument();
  });
});

// ── DashboardHome – metric grid ───────────────────────────────────────────────
import { DashboardHome } from '../DashboardHome';

// Stub fetchDashboardData so the component reaches the success state.
vi.mock('@/lib/dashboard', () => ({
  fetchDashboardData: vi.fn().mockResolvedValue({
    metrics: {
      totalSubscribers: 42,
      totalSubscribersChangePercent: 5,
      mrr: 1200,
      mrrChangePercent: 10,
      activeSubscriptions: 38,
      activeSubscriptionsChangePercent: -2,
    },
    recentActivity: [],
  }),
}));

describe('DashboardHome – metric grid layout', () => {
  it('loading skeleton uses md:grid-cols-2 lg:grid-cols-3 (not sm:grid-cols-3)', async () => {
    render(<DashboardHome />);
    // The loading skeleton grid is rendered immediately before data resolves.
    const skeletonGrid = document.querySelector(
      '[role="status"][aria-label="Loading metrics"]'
    );
    expect(skeletonGrid).not.toBeNull();
    expect(skeletonGrid!.className).toMatch(/md:grid-cols-2/);
    expect(skeletonGrid!.className).toMatch(/lg:grid-cols-3/);
    expect(skeletonGrid!.className).not.toMatch(/sm:grid-cols-3/);
  });

  it('success state metric grid uses md:grid-cols-2 lg:grid-cols-3', async () => {
    const { findByText } = render(<DashboardHome />);
    // Wait for async data load
    await findByText('Total subscribers');
    const metricGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    expect(metricGrid).not.toBeNull();
  });

  it('metric grid starts with grid-cols-1 (single column on mobile)', async () => {
    const { findByText } = render(<DashboardHome />);
    await findByText('Total subscribers');
    const metricGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(metricGrid).not.toBeNull();
  });
});

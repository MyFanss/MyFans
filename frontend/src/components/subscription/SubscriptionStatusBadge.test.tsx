import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubscriptionStatusBadge } from '@/components/subscription/SubscriptionStatusBadge';

describe('SubscriptionStatusBadge', () => {
  it('renders an accessible active badge', () => {
    render(<SubscriptionStatusBadge status="active" />);

    const badge = screen.getByRole('status', {
      name: 'Subscription status: active',
    });

    expect(badge).toHaveTextContent('Active');
    expect(badge).toHaveClass('text-emerald-950');
  });

  it('renders an accessible expired badge', () => {
    render(<SubscriptionStatusBadge status="expired" />);

    const badge = screen.getByRole('status', {
      name: 'Subscription status: expired',
    });

    expect(badge).toHaveTextContent('Expired');
    expect(badge).toHaveClass('text-amber-950');
  });

  it('renders an accessible cancelled badge', () => {
    render(<SubscriptionStatusBadge status="cancelled" />);

    const badge = screen.getByRole('status', {
      name: 'Subscription status: cancelled',
    });

    expect(badge).toHaveTextContent('Cancelled');
    expect(badge).toHaveClass('text-rose-950');
  });
});

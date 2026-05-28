import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NotificationInbox from '../NotificationInbox';

// Mock the dependencies
vi.mock('@/lib/notifications', async () => {
  const actual = await vi.importActual('@/lib/notifications') as any;
  return {
    ...actual,
    fetchNotifications: vi.fn(),
  };
});

vi.mock('@/components/ui/NotificationSkeleton', () => ({
  default: () => <div data-testid="notification-skeleton" />,
}));

describe('NotificationInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_USE_MOCK_NOTIFICATIONS = 'false';
  });

  it('renders skeletons while loading', async () => {
    const { fetchNotifications } = await import('@/lib/notifications');
    (fetchNotifications as any).mockReturnValue(new Promise(() => {}));

    render(<NotificationInbox />);
    
    const skeletons = screen.getAllByTestId('notification-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders notifications after loading', async () => {
    const { fetchNotifications } = await import('@/lib/notifications');
    (fetchNotifications as any).mockResolvedValue([
      { id: '1', type: 'new_subscriber', title: 'New subscriber', body: 'User subscribed', is_read: false, created_at: new Date().toISOString() }
    ]);

    render(<NotificationInbox />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('notification-skeleton')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('New subscriber')).toBeInTheDocument();
  });
});

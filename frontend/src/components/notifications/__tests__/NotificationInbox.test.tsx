import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import NotificationInbox from '../NotificationInbox';

// Mock the dependencies
vi.mock('@/lib/notifications', async () => {
  const actual = await vi.importActual('@/lib/notifications') as any;
  return {
    ...actual,
    fetchNotifications: vi.fn(),
    shouldUseMockNotifications: vi.fn(() => false),
  };
});

vi.mock('@/components/ui/NotificationSkeleton', () => ({
  default: () => <div data-testid="notification-skeleton" />,
}));

describe('NotificationInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_USE_MOCK_NOTIFICATIONS;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_USE_MOCK_NOTIFICATIONS;
  });

  it('defaults to API (not mock) and renders skeletons while loading', async () => {
    const { fetchNotifications, shouldUseMockNotifications } = await import('@/lib/notifications');
    (shouldUseMockNotifications as any).mockReturnValue(false);
    (fetchNotifications as any).mockReturnValue(new Promise(() => {}));

    render(<NotificationInbox />);

    expect(shouldUseMockNotifications).toHaveBeenCalled();
    const skeletons = screen.getAllByTestId('notification-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders notifications after loading from API', async () => {
    const { fetchNotifications, shouldUseMockNotifications } = await import('@/lib/notifications');
    (shouldUseMockNotifications as any).mockReturnValue(false);
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

  it('renders empty inbox without error when API returns []', async () => {
    const { fetchNotifications, shouldUseMockNotifications } = await import('@/lib/notifications');
    (shouldUseMockNotifications as any).mockReturnValue(false);
    (fetchNotifications as any).mockResolvedValue([]);

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeInTheDocument();
    });
  });

  it('surfaces API errors with retry', async () => {
    const { fetchNotifications, shouldUseMockNotifications } = await import('@/lib/notifications');
    (shouldUseMockNotifications as any).mockReturnValue(false);
    (fetchNotifications as any).mockRejectedValue(new Error('boom'));

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('boom');
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('uses mock data only when mock flag is opted in', async () => {
    const { fetchNotifications, shouldUseMockNotifications, MOCK_NOTIFICATIONS } = await import('@/lib/notifications');
    (shouldUseMockNotifications as any).mockReturnValue(true);

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.queryByTestId('notification-skeleton')).not.toBeInTheDocument();
    });

    expect(fetchNotifications).not.toHaveBeenCalled();
    expect(screen.getByText(MOCK_NOTIFICATIONS[0].title)).toBeInTheDocument();
  });
});

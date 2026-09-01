import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationInbox from './NotificationInbox';

// Mock the notifications library
vi.mock('@/lib/notifications', () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
  shouldUseMockNotifications: vi.fn(() => false),
  MOCK_NOTIFICATIONS: [
    { id: 'mock-1', user_id: 'u1', type: 'system', title: 'Mock', body: 'Mock notification', is_read: false, metadata: null, created_at: new Date().toISOString(), digest_count: 1, digest_event_times: null },
  ],
}));

// Mock NotificationItem
vi.mock('./NotificationItem', () => ({
  default: ({ notification, onMarkRead }: any) => (
    <div data-testid={`notification-${notification.id}`}>
      <span>{notification.title}</span>
      <button onClick={() => onMarkRead(notification.id, !notification.is_read)}>Toggle Read</button>
    </div>
  ),
}));

// Mock NotificationDetail
vi.mock('./NotificationDetail', () => ({
  default: ({ notification, onClose }: any) => (
    <div data-testid="notification-detail">
      <h2>{notification.title}</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock NotificationSkeleton
vi.mock('../ui/NotificationSkeleton', () => ({
  default: () => <div>Loading...</div>,
}));

describe('NotificationInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and display real notifications from API', async () => {
    const { fetchNotifications } = await import('@/lib/notifications');

    const mockNotifications = [
      {
        id: '1',
        user_id: 'u1',
        type: 'new_subscriber' as const,
        title: 'New subscriber',
        body: '@test subscribed',
        is_read: false,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
      {
        id: '2',
        user_id: 'u1',
        type: 'payout_sent' as const,
        title: 'Payout sent',
        body: 'Payout processed',
        is_read: true,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
    ];

    (fetchNotifications as any).mockResolvedValue(mockNotifications);

    render(<NotificationInbox />);

    // Wait for API call and rendering
    await waitFor(() => {
      expect(fetchNotifications).toHaveBeenCalled();
    });

    // Verify real notifications are displayed
    expect(screen.getByTestId('notification-1')).toBeInTheDocument();
    expect(screen.getByTestId('notification-2')).toBeInTheDocument();
    expect(screen.getByText('New subscriber')).toBeInTheDocument();
    expect(screen.getByText('Payout sent')).toBeInTheDocument();
  });

  it('should mark single notification as read', async () => {
    const { fetchNotifications, markNotificationRead } = await import('@/lib/notifications');

    const mockNotifications = [
      {
        id: '1',
        user_id: 'u1',
        type: 'new_subscriber' as const,
        title: 'New subscriber',
        body: '@test subscribed',
        is_read: false,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
    ];

    (fetchNotifications as any).mockResolvedValue(mockNotifications);
    (markNotificationRead as any).mockResolvedValue({ ...mockNotifications[0], is_read: true });

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-1')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: /Toggle Read/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith('1', true);
    });
  });

  it('should mark all notifications as read', async () => {
    const { fetchNotifications, markAllNotificationsRead } = await import('@/lib/notifications');

    const mockNotifications = [
      {
        id: '1',
        user_id: 'u1',
        type: 'new_subscriber' as const,
        title: 'New subscriber',
        body: '@test subscribed',
        is_read: false,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
      {
        id: '2',
        user_id: 'u1',
        type: 'payout_sent' as const,
        title: 'Payout sent',
        body: 'Payout processed',
        is_read: false,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
    ];

    (fetchNotifications as any).mockResolvedValue(mockNotifications);
    (markAllNotificationsRead as any).mockResolvedValue({ updated: 2 });

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    const markAllButton = screen.getByRole('button', { name: /Mark all as read/i });
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(markAllNotificationsRead).toHaveBeenCalled();
    });
  });

  it('should show empty state for no notifications', async () => {
    const { fetchNotifications } = await import('@/lib/notifications');

    (fetchNotifications as any).mockResolvedValue([]);

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByText(/No notifications yet/)).toBeInTheDocument();
    });
  });

  it('should show unread count badge', async () => {
    const { fetchNotifications } = await import('@/lib/notifications');

    const mockNotifications = [
      {
        id: '1',
        user_id: 'u1',
        type: 'new_subscriber' as const,
        title: 'New subscriber',
        body: '@test subscribed',
        is_read: false,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
      {
        id: '2',
        user_id: 'u1',
        type: 'payout_sent' as const,
        title: 'Payout sent',
        body: 'Payout processed',
        is_read: true,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
    ];

    (fetchNotifications as any).mockResolvedValue(mockNotifications);

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByLabelText(/1 unread/)).toBeInTheDocument();
    });
  });

  it('should filter by unread status', async () => {
    const { fetchNotifications } = await import('@/lib/notifications');

    const mockNotifications = [
      {
        id: '1',
        user_id: 'u1',
        type: 'new_subscriber' as const,
        title: 'New subscriber',
        body: '@test subscribed',
        is_read: false,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
      {
        id: '2',
        user_id: 'u1',
        type: 'payout_sent' as const,
        title: 'Payout sent',
        body: 'Payout processed',
        is_read: true,
        metadata: null,
        created_at: new Date().toISOString(),
        digest_count: 1,
        digest_event_times: null,
      },
    ];

    (fetchNotifications as any).mockResolvedValue(mockNotifications);

    render(<NotificationInbox />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-1')).toBeInTheDocument();
    });

    // Click unread filter tab
    const unreadTab = screen.getByRole('tab', { name: /unread/i });
    fireEvent.click(unreadTab);

    // Should only show unread notification
    expect(screen.getByTestId('notification-1')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-2')).not.toBeInTheDocument();
  });
});

/**
 * Unit tests for the notifications inbox page.
 *
 * Issue #2009: a failed fetch must render a distinct error state with a
 * Retry action, never the same UI as a genuinely empty inbox.
 * Issue #2007: a successful "Mark all as read" must flip every item to
 * read (clearing the Unread tab); a failed one must leave items untouched
 * and surface an error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsPage from './page';
import * as notificationsApi from '@/lib/notifications-api';
import type { Notification } from '@/lib/notifications-api';

vi.mock('@/lib/notifications-api', () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const mockedFetch = vi.mocked(notificationsApi.fetchNotifications);
const mockedMarkAllRead = vi.mocked(notificationsApi.markAllNotificationsRead);

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: '1',
    type: 'new_subscriber',
    title: 'New subscriber',
    body: 'Someone subscribed',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an error state with a Retry button on a failed fetch, not the empty state', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));
    render(<NotificationsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('network down');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/No notifications yet/)).not.toBeInTheDocument();
  });

  it('renders the empty state (no error) when fetch resolves with zero items', async () => {
    mockedFetch.mockResolvedValue({ data: [], hasMore: false, nextCursor: null });
    render(<NotificationsPage />);

    expect(await screen.findByText(/No notifications yet/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clicking Retry re-issues fetchNotifications and clears the error on success', async () => {
    const user = userEvent.setup();
    mockedFetch.mockRejectedValueOnce(new Error('network down'));
    render(<NotificationsPage />);

    await screen.findByRole('alert');
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    mockedFetch.mockResolvedValueOnce({ data: [], hasMore: false, nextCursor: null });
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/No notifications yet/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('marks every item read and empties the Unread tab after a successful "Mark all as read"', async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({
      data: [makeNotification({ id: '1' }), makeNotification({ id: '2' })],
      hasMore: false,
      nextCursor: null,
    });
    mockedMarkAllRead.mockResolvedValue(undefined);
    render(<NotificationsPage />);

    await screen.findByRole('list');
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(mockedMarkAllRead).toHaveBeenCalledTimes(1);
    // The "Mark all as read" button only renders while there's an unread
    // item, so once every item is read it must disappear.
    await screen.findByRole('list');
    expect(
      screen.queryByRole('button', { name: 'Mark all as read' }),
    ).not.toBeInTheDocument();
  });

  it('leaves items unread and shows an error when "Mark all as read" fails', async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValue({
      data: [makeNotification({ id: '1' })],
      hasMore: false,
      nextCursor: null,
    });
    mockedMarkAllRead.mockRejectedValue(new Error('server error'));
    render(<NotificationsPage />);

    await screen.findByRole('list');
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('server error');
    // The button must still be present -- the item is still unread.
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument();
  });
});

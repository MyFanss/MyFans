/**
 * Unit tests for notifications lib helpers
 */

import {
  MOCK_NOTIFICATIONS,
  type Notification,
} from '../notifications';

describe('MOCK_NOTIFICATIONS', () => {
  it('contains at least one notification', () => {
    expect(MOCK_NOTIFICATIONS.length).toBeGreaterThan(0);
  });

  it('each notification has required fields', () => {
    for (const n of MOCK_NOTIFICATIONS) {
      expect(n).toHaveProperty('id');
      expect(n).toHaveProperty('type');
      expect(n).toHaveProperty('title');
      expect(n).toHaveProperty('body');
      expect(typeof n.is_read).toBe('boolean');
      expect(n).toHaveProperty('created_at');
    }
  });

  it('has both read and unread notifications', () => {
    const unread = MOCK_NOTIFICATIONS.filter((n) => !n.is_read);
    const read = MOCK_NOTIFICATIONS.filter((n) => n.is_read);
    expect(unread.length).toBeGreaterThan(0);
    expect(read.length).toBeGreaterThan(0);
  });

  it('notifications are sorted newest first by created_at', () => {
    const sorted = [...MOCK_NOTIFICATIONS].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    expect(MOCK_NOTIFICATIONS.map((n) => n.id)).toEqual(sorted.map((n) => n.id));
  });
});

describe('fetchNotifications (mocked fetch)', () => {
  const mockNotif: Notification = {
    id: 'test-1',
    user_id: 'u1',
    type: 'system',
    title: 'Test',
    body: 'Test body',
    is_read: false,
    metadata: null,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the correct endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [mockNotif],
    });

    const { fetchNotifications } = await import('../notifications');
    const result = await fetchNotifications();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/notifications'),
      expect.any(Object),
    );
    expect(result).toEqual([mockNotif]);
  });

  it('appends unread_only query param when requested', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { fetchNotifications } = await import('../notifications');
    await fetchNotifications(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('unread_only=true'),
      expect.any(Object),
    );
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    const { fetchNotifications } = await import('../notifications');
    await expect(fetchNotifications()).rejects.toThrow('Unauthorized');
  });
});

describe('markAllNotificationsRead (mocked fetch)', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls PATCH mark-all-read endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updated: 3 }),
    });

    const { markAllNotificationsRead } = await import('../notifications');
    const result = await markAllNotificationsRead();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('mark-all-read'),
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(result).toEqual({ updated: 3 });
  });
});

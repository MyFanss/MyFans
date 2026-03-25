'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/lib/notifications';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  MOCK_NOTIFICATIONS,
} from '@/lib/notifications';
import NotificationItem from './NotificationItem';
import NotificationDetail from './NotificationDetail';

type Filter = 'all' | 'unread';

const USE_MOCK = true; // set to false when backend is ready

export default function NotificationInbox() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Notification | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = USE_MOCK
        ? MOCK_NOTIFICATIONS
        : await fetchNotifications(filter === 'unread');
      const filtered = filter === 'unread' ? data.filter((n) => !n.is_read) : data;
      setNotifications(filtered);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback(async (id: string, isRead: boolean) => {
    setNotifications((prev: Notification[]) =>
      prev.map((n: Notification) => (n.id === id ? { ...n, is_read: isRead } : n)),
    );
    if (selected?.id === id) setSelected((s: Notification | null) => s ? { ...s, is_read: isRead } : s);
    if (!USE_MOCK) {
      await markNotificationRead(id, isRead).catch(() => load());
    }
  }, [selected, load]);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev: Notification[]) => prev.map((n: Notification) => ({ ...n, is_read: true })));
    if (!USE_MOCK) {
      await markAllNotificationsRead().catch(() => load());
    }
  }, [load]);

  const handleDelete = useCallback(async (id: string) => {
    setNotifications((prev: Notification[]) => prev.filter((n: Notification) => n.id !== id));
    if (!USE_MOCK) {
      await deleteNotification(id).catch(() => load());
    }
  }, [load]);

  const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;
  const displayed = filter === 'unread' ? notifications.filter((n: Notification) => !n.is_read) : notifications;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Notifications</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-blue-500 text-white text-xs font-medium" aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Notification filters">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              filter === f
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex justify-center py-12" aria-live="polite" aria-busy="true">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-label="Loading notifications" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
          <button onClick={load} className="ml-2 underline">Retry</button>
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500" aria-live="polite">
          <span className="text-4xl mb-3" aria-hidden="true">🔔</span>
          <p className="text-sm">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <ul className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" aria-label="Notification list">
          {displayed.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              onClick={setSelected}
            />
          ))}
        </ul>
      )}

      {/* Detail modal */}
      {selected && (
        <NotificationDetail
          notification={selected}
          onClose={() => setSelected(null)}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

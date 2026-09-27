/**
 * Notifications page — /notifications
 *
 * Live notification inbox wired to /api/v1/notifications.
 * Mock data is never used in production — all data comes from the backend.
 *
 * e2e contract (notifications.spec.ts):
 *   - heading: "Notifications"
 *   - tabs: role="tab" with names "All" and "Unread"
 *   - list: role="list" aria-label="Notification list"
 *   - items: role="button" with aria-label on each item
 *   - detail: role="dialog" with close button aria-label="Close"
 *   - mark all button: "Mark all as read"
 *   - digest badge: aria-label matching /events batched/i
 *   - digest detail: data-testid="digest-summary"
 *
 * Refs: #1830, frontend/e2e/notifications.spec.ts
 */
'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/notifications-api';

// ── State ─────────────────────────────────────────────────────────────────

type Filter = 'all' | 'unread';

interface NotifState {
  filter: Filter;
  items: Notification[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  nextCursor: string | null;
}

type NotifAction =
  | { type: 'SET_FILTER'; filter: Filter }
  | { type: 'LOAD_START' }
  | { type: 'LOAD_DONE'; items: Notification[]; hasMore: boolean; nextCursor: string | null }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_ALL_READ' };

function reducer(state: NotifState, action: NotifAction): NotifState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, filter: action.filter, items: [], loading: true, error: null };
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_DONE':
      return {
        ...state,
        loading: false,
        items: action.items,
        hasMore: action.hasMore,
        nextCursor: action.nextCursor,
      };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'MARK_READ':
      return {
        ...state,
        items: state.items.map((n) =>
          n.id === action.id ? { ...n, isRead: true } : n,
        ),
      };
    case 'MARK_ALL_READ':
      return { ...state, items: state.items.map((n) => ({ ...n, isRead: true })) };
    default:
      return state;
  }
}

// ── Detail dialog ─────────────────────────────────────────────────────────

interface DetailDialogProps {
  notification: Notification;
  onClose: () => void;
}

function DetailDialog({ notification, onClose }: DetailDialogProps) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="notif-dialog-title" className="notif-dialog">
      <div className="notif-dialog__inner">
        <button
          type="button"
          aria-label="Close"
          className="notif-dialog__close"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 id="notif-dialog-title" className="notif-dialog__title">
          {notification.title}
        </h2>
        <p className="notif-dialog__body">{notification.body}</p>
        <time className="notif-dialog__time" dateTime={notification.createdAt}>
          {new Date(notification.createdAt).toLocaleString()}
        </time>

        {/* Digest summary (shown only for digest-type notifications) */}
        {notification.digestCount != null && (
          <div data-testid="digest-summary" className="notif-dialog__digest">
            <span
              aria-label={`${notification.digestCount} events batched`}
              className="notif-dialog__digest-count"
            >
              {notification.digestCount} events batched
            </span>
            {notification.digestSummary && (
              <p className="notif-dialog__digest-summary">{notification.digestSummary}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Notification item ─────────────────────────────────────────────────────

interface NotifItemProps {
  notification: Notification;
  onClick: () => void;
}

function NotifItem({ notification, onClick }: NotifItemProps) {
  return (
    <li className={`notif-item${notification.isRead ? '' : ' notif-item--unread'}`}>
      <button
        type="button"
        aria-label={`${notification.title} — ${new Date(notification.createdAt).toLocaleDateString()}`}
        className="notif-item__btn"
        onClick={onClick}
      >
        <span className="notif-item__title">{notification.title}</span>
        {!notification.isRead && (
          <span className="notif-item__unread-dot" aria-hidden="true" />
        )}
        {notification.digestCount != null && (
          <span
            aria-label={`${notification.digestCount} events batched`}
            className="notif-item__digest-badge"
          >
            {notification.digestCount}
          </span>
        )}
        <time className="notif-item__time" dateTime={notification.createdAt}>
          {new Date(notification.createdAt).toLocaleDateString()}
        </time>
      </button>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [state, dispatch] = useReducer(reducer, {
    filter: 'all',
    items: [],
    loading: true,
    error: null,
    hasMore: false,
    nextCursor: null,
  });

  const [active, setActive] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    async (filter: Filter) => {
      dispatch({ type: 'LOAD_START' });
      try {
        const page = await fetchNotifications(filter);
        dispatch({
          type: 'LOAD_DONE',
          items: page.data,
          hasMore: page.hasMore,
          nextCursor: page.nextCursor,
        });
      } catch (err) {
        dispatch({
          type: 'LOAD_ERROR',
          error: err instanceof Error ? err.message : 'Failed to load notifications.',
        });
      }
    },
    [],
  );

  useEffect(() => {
    void load(state.filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.filter]);

  function handleSetFilter(filter: Filter) {
    dispatch({ type: 'SET_FILTER', filter });
  }

  async function handleItemClick(n: Notification) {
    setActive(n);
    if (!n.isRead) {
      dispatch({ type: 'MARK_READ', id: n.id });
      try {
        await markNotificationRead(n.id);
      } catch {
        // Non-fatal: optimistic update already applied.
      }
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      dispatch({ type: 'MARK_ALL_READ' });
    } catch {
      // Non-fatal.
    } finally {
      setMarkingAll(false);
    }
  }

  const hasUnread = state.items.some((n) => !n.isRead);

  return (
    <main className="notifications-page">
      <h1 className="notifications-page__title">Notifications</h1>

      {/* Filter tabs */}
      <div role="tablist" aria-label="Notification filters" className="notifications-page__tabs">
        {(['all', 'unread'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={state.filter === f}
            type="button"
            className={`notifications-page__tab${state.filter === f ? ' notifications-page__tab--active' : ''}`}
            onClick={() => handleSetFilter(f)}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {/* Mark all as read */}
      {hasUnread && (
        <button
          type="button"
          className="notifications-page__mark-all"
          disabled={markingAll}
          aria-busy={markingAll}
          onClick={() => void handleMarkAllRead()}
        >
          Mark all as read
        </button>
      )}

      {/* Loading */}
      {state.loading && (
        <p className="notifications-page__status" role="status">
          Loading notifications…
        </p>
      )}

      {/* Error */}
      {!state.loading && state.error && (
        <p className="notifications-page__error" role="alert">
          {state.error}
        </p>
      )}

      {/* Empty state */}
      {!state.loading && !state.error && state.items.length === 0 && (
        <p className="notifications-page__empty">
          {state.filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
        </p>
      )}

      {/* List */}
      {state.items.length > 0 && (
        <ul
          role="list"
          aria-label="Notification list"
          className="notifications-page__list"
        >
          {state.items.map((n) => (
            <NotifItem
              key={n.id}
              notification={n}
              onClick={() => void handleItemClick(n)}
            />
          ))}
        </ul>
      )}

      {/* Detail dialog */}
      {active && (
        <div className="notifications-page__overlay" role="presentation">
          <DetailDialog notification={active} onClose={() => setActive(null)} />
        </div>
      )}
    </main>
  );
}

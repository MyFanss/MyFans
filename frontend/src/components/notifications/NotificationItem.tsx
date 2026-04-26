'use client';

import type { Notification, NotificationType } from '@/lib/notifications';

const TYPE_ICONS: Record<NotificationType, string> = {
  new_subscriber: '👤',
  subscription_renewed: '🔄',
  subscription_cancelled: '❌',
  new_comment: '💬',
  new_like: '❤️',
  new_message: '✉️',
  payout_sent: '💸',
  content_published: '📄',
  system: '🔔',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  notification: Notification;
  onMarkRead: (id: string, isRead: boolean) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
}

export default function NotificationItem({ notification, onMarkRead, onDelete, onClick }: Props) {
  const { id, type, title, body, is_read, created_at, digest_count } = notification;

  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!is_read ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}`}
      onClick={() => onClick(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(notification)}
      aria-label={`${title}: ${body}`}
    >
      <span className="text-xl mt-0.5 shrink-0" aria-hidden="true">{TYPE_ICONS[type]}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={`text-sm truncate ${!is_read ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
              {title}
            </p>
            {digest_count > 1 && (
              <span
                className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium shrink-0"
                aria-label={`${digest_count} events batched`}
              >
                {digest_count}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{timeAgo(created_at)}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{body}</p>
      </div>

      <div className="flex flex-col gap-1 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
        {!is_read ? (
          <button
            onClick={() => onMarkRead(id, true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            aria-label="Mark as read"
          >
            Mark read
          </button>
        ) : (
          <button
            onClick={() => onMarkRead(id, false)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:underline whitespace-nowrap"
            aria-label="Mark as unread"
          >
            Unread
          </button>
        )}
        <button
          onClick={() => onDelete(id)}
          className="text-xs text-red-400 hover:text-red-600 hover:underline"
          aria-label="Delete notification"
        >
          Delete
        </button>
      </div>

      {!is_read && (
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" aria-hidden="true" />
      )}
    </li>
  );
}

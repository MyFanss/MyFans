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

const TYPE_LABELS: Record<NotificationType, string> = {
  new_subscriber: 'New Subscriber',
  subscription_renewed: 'Subscription Renewed',
  subscription_cancelled: 'Subscription Cancelled',
  new_comment: 'New Comment',
  new_like: 'New Like',
  new_message: 'New Message',
  payout_sent: 'Payout Sent',
  content_published: 'Content Published',
  system: 'System',
};

interface Props {
  notification: Notification;
  onClose: () => void;
  onMarkRead: (id: string, isRead: boolean) => void;
  onDelete: (id: string) => void;
}

export default function NotificationDetail({ notification, onClose, onMarkRead, onDelete }: Props) {
  const { id, type, title, body, is_read, created_at, metadata, digest_count, digest_event_times } = notification;

  const handleDelete = () => {
    onDelete(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">{TYPE_ICONS[type]}</span>
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {TYPE_LABELS[type]}
              </p>
              <h2 id="notif-detail-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{body}</p>

        {digest_count > 1 && digest_event_times && digest_event_times.length > 0 && (
          <div
            className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 px-3 py-2 mb-4"
            data-testid="digest-summary"
          >
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
              {digest_count} events batched
            </p>
            <ul className="space-y-0.5">
              {digest_event_times.map((t, i) => (
                <li key={i} className="text-xs text-blue-600 dark:text-blue-400">
                  {new Date(t).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {metadata && Object.keys(metadata).length > 0 && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 mb-4 text-xs text-slate-500 dark:text-slate-400">
            {Object.entries(metadata).map(([k, v]) => (
              <div key={k}><span className="font-medium">{k}:</span> {String(v)}</div>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
          {new Date(created_at).toLocaleString()}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => onMarkRead(id, !is_read)}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {is_read ? 'Mark as unread' : 'Mark as read'}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

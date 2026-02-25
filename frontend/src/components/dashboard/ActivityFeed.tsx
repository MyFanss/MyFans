'use client';

import React from 'react';
import { BaseCard } from '@/components/cards';
import type { ActivityItem } from '@/lib/dashboard';

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function typeIcon(type: ActivityItem['type']) {
  const base = 'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center';
  const green = 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  const blue = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
  const amber = 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
  const red = 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  switch (type) {
    case 'subscription':
      return (
        <span className={`${base} ${green}`} aria-hidden>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" /></svg>
        </span>
      );
    case 'renewal':
      return (
        <span className={`${base} ${blue}`} aria-hidden>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885 6.002 6.002 0 00-9.716-2.2V3a1 1 0 011-1zm8 12a1 1 0 01-1 1H9a1 1 0 01-1-1v-1a1 1 0 012 0v.5h1a1 1 0 011 1z" clipRule="evenodd" /></svg>
        </span>
      );
    case 'content':
      return (
        <span className={`${base} ${amber}`} aria-hidden>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
        </span>
      );
    case 'cancellation':
      return (
        <span className={`${base} ${red}`} aria-hidden>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </span>
      );
    case 'payout':
      return (
        <span className={`${base} ${green}`} aria-hidden>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676 1.096C6.97 7.087 6.905 7.5 7 8c.095.5.03.913-.324 1.204C6.3 9.47 6 10.036 6 11v.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V8.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V7a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676 1.096C6.97 7.087 6.905 7.5 7 8c.095.5.03.913-.324 1.204C6.3 9.47 6 10.036 6 11v.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V8.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V7z" clipRule="evenodd" /></svg>
        </span>
      );
    default:
      return <span className={`${base} bg-gray-100 dark:bg-gray-700`} aria-hidden />;
  }
}

export interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <BaseCard className="flex flex-col" padding="lg" as="section" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Recent activity
      </h2>
      <ul className="space-y-4">
        {items.slice(0, 5).map((item) => (
          <li key={item.id} className="flex gap-3">
            {typeIcon(item.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {item.metadata && (
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.metadata}</span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatTimeAgo(item.timestamp)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </BaseCard>
  );
}

export default ActivityFeed;

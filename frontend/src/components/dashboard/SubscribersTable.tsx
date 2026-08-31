'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Badge from '../ui/Badge';
import DataTable, { ColumnDef, SortState } from '../ui/DataTable';
import { apiClient } from '@/clients/api-client';

type SubscriberStatus = 'active' | 'expired';

interface Subscriber {
  id: string;
  fanAddress: string;
  creatorAddress: string;
  planId: number;
  status: SubscriberStatus;
  expiresAt: string;
  createdAt: string;
}


type SubscriberKey = 'fanAddress' | 'status' | 'createdAt' | 'expiresAt';

const COLUMNS: ColumnDef<Subscriber, SubscriberKey>[] = [
  {
    key: 'fanAddress',
    header: 'Subscriber',
    sortable: false,
    render: (sub) => (
      <div>
        <div className="font-medium text-gray-900 dark:text-white">{sub.fanAddress.slice(0, 16)}...</div>
        <div className="text-xs text-gray-500">Plan #{sub.planId}</div>
      </div>
    ),
  },
  {
    key: 'createdAt',
    header: 'Joined',
    sortable: true,
    render: (sub) => (
      <div className="text-sm text-gray-900 dark:text-white">
        {new Date(sub.createdAt).toLocaleDateString()}
      </div>
    ),
  },
  {
    key: 'expiresAt',
    header: 'Expires',
    sortable: true,
    render: (sub) => (
      <div className="text-sm text-gray-900 dark:text-white">
        {new Date(sub.expiresAt).toLocaleDateString()}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (sub) => {
      const variant = sub.status === 'active' ? 'success' : 'default';
      return <Badge variant={variant}>{sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}</Badge>;
    },
  },
];

/** Mobile card view for a single subscriber row */
function SubscriberCard({ sub }: { sub: Subscriber }) {
  const variant = sub.status === 'active' ? 'success' : 'default';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{sub.fanAddress.slice(0, 16)}...</p>
          <p className="text-xs text-gray-500">Plan #{sub.planId}</p>
        </div>
        <div className="shrink-0">
          <Badge variant={variant}>{sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Joined</p>
          <p className="text-gray-900 dark:text-white">{new Date(sub.createdAt).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Expires</p>
          <p className="text-gray-900 dark:text-white">{new Date(sub.expiresAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

export default function SubscribersTable() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'expired' | undefined>(undefined);
  const [sort, setSort] = useState<SortState<SubscriberKey>>({ key: 'createdAt', direction: 'desc' });
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 20;

  // Fetch subscribers from API
  useEffect(() => {
    async function fetchSubscribers() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getCreatorSubscribers({
          cursor,
          limit: PAGE_SIZE,
          status: statusFilter,
          sort: sort.key === 'expiresAt' ? 'expiry' : 'created',
        });
        setSubscribers(response.data || []);
        setNextCursor(response.nextCursor || undefined);
        setHasMore(response.hasMore || false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscribers');
        setSubscribers([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscribers();
  }, [cursor, statusFilter, sort]);

  const handleNextPage = () => {
    if (nextCursor && hasMore) {
      setCursor(nextCursor);
    }
  };

  const handlePrevPage = () => {
    setCursor(undefined);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-end">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'expired' | undefined || undefined)}
            aria-label="Filter by status"
            disabled={loading}
            className="w-full sm:w-44 pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors appearance-none disabled:opacity-50"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">Error loading subscribers: {error}</p>
        </div>
      )}

      {loading && subscribers.length === 0 ? (
        <div className="hidden sm:block space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ) : subscribers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No subscribers yet. When you have subscribers, they'll appear here.
          </p>
        </div>
      ) : (
        <>
          <DataTable<Subscriber, SubscriberKey>
            columns={COLUMNS}
            data={subscribers}
            keyExtractor={(s) => s.id}
            sort={sort}
            onSortChange={setSort}
            emptyMessage="No subscribers found."
            caption="Subscribers"
            className="hidden sm:block"
          />

          {/* Mobile card stack — shown only on small screens */}
          <div className="sm:hidden space-y-3" aria-label="Subscribers">
            {subscribers.map((sub) => <SubscriberCard key={sub.id} sub={sub} />)}
            {hasMore && (
              <div className="flex gap-2 justify-center pt-2">
                <button
                  onClick={handlePrevPage}
                  disabled={!cursor}
                  aria-label="Previous page"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={!hasMore}
                  aria-label="Next page"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

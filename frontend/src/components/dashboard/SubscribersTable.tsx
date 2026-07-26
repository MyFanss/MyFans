'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Search, Download } from 'lucide-react';
import Badge from '../ui/Badge';
import DataTable, { ColumnDef, SortState } from '../ui/DataTable';
import { useImageLoad } from '@/hooks/useImageLoad';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/clients/api-client';

type SubscriberStatus = 'Active' | 'Cancelled' | 'Past Due';

interface Subscriber {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: string;
  tier: string;
  joinDate: string;
  renewDate: string;
  status: SubscriberStatus;
  totalPaid: number;
}


type SubscriberKey = 'name' | 'plan' | 'joinDate' | 'status' | 'totalPaid';

const COLUMNS: ColumnDef<Subscriber, SubscriberKey>[] = [
  {
    key: 'name',
    header: 'Fan',
    sortable: true,
    render: (sub) => (
      <div className="flex items-center gap-3">
        <SubscriberAvatar src={sub.avatar} name={sub.name} />
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{sub.name}</div>
          <div className="text-xs text-gray-500">{sub.email}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'plan',
    header: 'Plan',
    sortable: true,
    render: (sub) => (
      <div>
        <div className="font-medium text-gray-900 dark:text-white">{sub.plan}</div>
        <div className="text-xs text-gray-500">{sub.tier}</div>
      </div>
    ),
  },
  {
    key: 'joinDate',
    header: 'Dates',
    sortable: true,
    render: (sub) => (
      <div>
        <div className="text-gray-900 dark:text-white">Joined: {sub.joinDate}</div>
        <div className="text-xs text-gray-500">Renews: {sub.renewDate}</div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (sub) => {
      const variant = sub.status === 'Active' ? 'success' : sub.status === 'Past Due' ? 'error' : 'default';
      return <Badge variant={variant}>{sub.status}</Badge>;
    },
  },
  {
    key: 'totalPaid',
    header: 'Total Paid',
    sortable: true,
    className: 'text-right font-medium text-gray-900 dark:text-white',
    headerClassName: 'text-right',
    render: (sub) => `$${sub.totalPaid.toFixed(2)}`,
  },
];

/** Avatar with lazy-load skeleton, used in both table and card views */
function SubscriberAvatar({ src, name }: { src: string; name: string }) {
  const { isLoaded, onLoad } = useImageLoad();
  return (
    <div className="image-skeleton-wrapper relative w-9 h-9 rounded-full shrink-0">
      <Image
        className={`lazy-image w-9 h-9 rounded-full object-cover ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        src={src}
        alt={name}
        width={36}
        height={36}
        loading="lazy"
        onLoad={onLoad}
      />
      {!isLoaded && <Skeleton className="absolute inset-0" rounded="full" />}
    </div>
  );
}

/** Mobile card view for a single subscriber row */
function SubscriberCard({ sub }: { sub: Subscriber }) {
  const variant = sub.status === 'Active' ? 'success' : sub.status === 'Past Due' ? 'error' : 'default';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <SubscriberAvatar src={sub.avatar} name={sub.name} />
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{sub.name}</p>
          <p className="text-xs text-gray-500 truncate">{sub.email}</p>
        </div>
        <div className="ml-auto shrink-0">
          <Badge variant={variant}>{sub.status}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Plan</p>
          <p className="font-medium text-gray-900 dark:text-white">{sub.plan}</p>
          <p className="text-xs text-gray-500">{sub.tier}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total paid</p>
          <p className="font-medium text-gray-900 dark:text-white">${sub.totalPaid.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Joined</p>
          <p className="text-gray-900 dark:text-white">{sub.joinDate}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Renews</p>
          <p className="text-gray-900 dark:text-white">{sub.renewDate}</p>
        </div>
      </div>
    </div>
  );
}

export default function SubscribersTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort] = useState<SortState<SubscriberKey>>({ key: 'joinDate', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const PAGE_SIZE = 5;

  // Fetch subscribers from API
  useEffect(() => {
    async function fetchSubscribers() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getCreatorSubscribers({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined,
        });
        setSubscribers(response.data || []);
        setTotalCount(response.total || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscribers');
        setSubscribers([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscribers();
  }, [page, search, statusFilter]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const mobilePageData = subscribers;

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Plan', 'Tier', 'Join Date', 'Renew Date', 'Status', 'Total Paid'];
    const rows = subscribers.map((s) => `"${s.name}","${s.email}","${s.plan}","${s.tier}","${s.joinDate}","${s.renewDate}","${s.status}","${s.totalPaid}"`);
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'subscribers_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-end">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" aria-hidden />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search subscribers"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
              disabled={loading}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            disabled={loading}
            className="w-full sm:w-44 pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors appearance-none disabled:opacity-50"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Past Due">Past Due</option>
          </select>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={loading || subscribers.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full md:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" aria-hidden />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">Error loading subscribers: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="hidden sm:block space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      ) : (
        <>
          <DataTable<Subscriber, SubscriberKey>
            columns={COLUMNS}
            data={subscribers}
            keyExtractor={(s) => s.id}
            sort={sort}
            onSortChange={setSort}
            page={page}
            onPageChange={setPage}
            pageSize={PAGE_SIZE}
            emptyMessage="No subscribers found matching your criteria."
            caption="Subscribers"
            className="hidden sm:block"
          />

          {/* Mobile card stack — shown only on small screens */}
          <div className="sm:hidden space-y-3" aria-label="Subscribers">
            {mobilePageData.length === 0 ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                No subscribers found matching your criteria.
              </p>
            ) : (
              mobilePageData.map((sub) => <SubscriberCard key={sub.id} sub={sub} />)
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

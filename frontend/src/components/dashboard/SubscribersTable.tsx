'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Search, Download } from 'lucide-react';
import Badge from '../ui/Badge';
import DataTable, { ColumnDef, SortState } from '../ui/DataTable';

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

const MOCK_DATA: Subscriber[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', avatar: 'https://i.pravatar.cc/150?u=1', plan: 'VIP Access', tier: '$20/mo', joinDate: '2023-01-15', renewDate: '2023-02-15', status: 'Active', totalPaid: 240 },
  { id: '2', name: 'Bob Johnson', email: 'bob@example.com', avatar: 'https://i.pravatar.cc/150?u=2', plan: 'Supporter', tier: '$5/mo', joinDate: '2023-05-20', renewDate: '2023-06-20', status: 'Active', totalPaid: 45 },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', avatar: 'https://i.pravatar.cc/150?u=3', plan: 'VIP Access', tier: '$20/mo', joinDate: '2022-11-01', renewDate: '2023-11-01', status: 'Past Due', totalPaid: 400 },
  { id: '4', name: 'Diana Prince', email: 'diana@example.com', avatar: 'https://i.pravatar.cc/150?u=4', plan: 'Exclusive Content', tier: '$10/mo', joinDate: '2023-06-10', renewDate: '2023-07-10', status: 'Cancelled', totalPaid: 30 },
  { id: '5', name: 'Evan Davis', email: 'evan@example.com', avatar: 'https://i.pravatar.cc/150?u=5', plan: 'Supporter', tier: '$5/mo', joinDate: '2023-07-01', renewDate: '2023-08-01', status: 'Active', totalPaid: 5 },
  { id: '6', name: 'Fiona Gallagher', email: 'fiona@example.com', avatar: 'https://i.pravatar.cc/150?u=6', plan: 'VIP Access', tier: '$20/mo', joinDate: '2023-02-28', renewDate: '2023-03-28', status: 'Active', totalPaid: 100 },
  { id: '7', name: 'George Miller', email: 'george@example.com', avatar: 'https://i.pravatar.cc/150?u=7', plan: 'Exclusive Content', tier: '$10/mo', joinDate: '2023-03-15', renewDate: '2023-04-15', status: 'Active', totalPaid: 50 },
  { id: '8', name: 'Hannah Abbott', email: 'hannah@example.com', avatar: 'https://i.pravatar.cc/150?u=8', plan: 'Supporter', tier: '$5/mo', joinDate: '2023-04-10', renewDate: '2023-05-10', status: 'Cancelled', totalPaid: 15 },
  { id: '9', name: 'Ian Malcolm', email: 'ian@example.com', avatar: 'https://i.pravatar.cc/150?u=9', plan: 'VIP Access', tier: '$20/mo', joinDate: '2023-01-05', renewDate: '2023-02-05', status: 'Past Due', totalPaid: 20 },
  { id: '10', name: 'Julia Roberts', email: 'julia@example.com', avatar: 'https://i.pravatar.cc/150?u=10', plan: 'Exclusive Content', tier: '$10/mo', joinDate: '2023-05-05', renewDate: '2023-06-05', status: 'Active', totalPaid: 20 },
  { id: '11', name: 'Kevin Hart', email: 'kevin@example.com', avatar: 'https://i.pravatar.cc/150?u=11', plan: 'Supporter', tier: '$5/mo', joinDate: '2023-06-25', renewDate: '2023-07-25', status: 'Active', totalPaid: 10 },
  { id: '12', name: 'Laura Dern', email: 'laura@example.com', avatar: 'https://i.pravatar.cc/150?u=12', plan: 'VIP Access', tier: '$20/mo', joinDate: '2023-02-14', renewDate: '2023-03-14', status: 'Active', totalPaid: 120 },
];

type SubscriberKey = 'name' | 'plan' | 'joinDate' | 'status' | 'totalPaid';

const COLUMNS: ColumnDef<Subscriber, SubscriberKey>[] = [
  {
    key: 'name',
    header: 'Fan',
    sortable: true,
    render: (sub) => (
      <div className="flex items-center gap-3">
        <Image className="w-9 h-9 rounded-full object-cover shrink-0" src={sub.avatar} alt={sub.name} width={36} height={36} />
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

export default function SubscribersTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort] = useState<SortState<SubscriberKey>>({ key: 'joinDate', direction: 'desc' });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = MOCK_DATA;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    if (statusFilter !== 'All') {
      result = result.filter((s) => s.status === statusFilter);
    }
    return result;
  }, [search, statusFilter]);

  // Reset page when filters change
  React.useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Plan', 'Tier', 'Join Date', 'Renew Date', 'Status', 'Total Paid'];
    const rows = filtered.map((s) => `"${s.name}","${s.email}","${s.plan}","${s.tier}","${s.joinDate}","${s.renewDate}","${s.status}","${s.totalPaid}"`);
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
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="w-full sm:w-44 pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors appearance-none"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Past Due">Past Due</option>
          </select>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full md:w-auto justify-center"
        >
          <Download className="w-4 h-4" aria-hidden />
          Export CSV
        </button>
      </div>

      <DataTable<Subscriber, SubscriberKey>
        columns={COLUMNS}
        data={filtered}
        keyExtractor={(s) => s.id}
        sort={sort}
        onSortChange={setSort}
        page={page}
        onPageChange={setPage}
        pageSize={5}
        emptyMessage="No subscribers found matching your criteria."
        caption="Subscribers"
      />
    </div>
  );
}

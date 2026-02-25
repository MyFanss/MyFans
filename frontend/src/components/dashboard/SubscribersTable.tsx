'use client';

import React, { useState, useMemo } from 'react';
import { Search, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from '../ui/Badge';

// Mock Data
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

type SortConfig = {
  key: keyof Subscriber | null;
  direction: 'asc' | 'desc';
};

export default function SubscribersTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'joinDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter, Sort, Paginate
  const processedData = useMemo(() => {
    let result = MOCK_DATA;

    // Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(sub => sub.name.toLowerCase().includes(lowerSearch) || sub.email.toLowerCase().includes(lowerSearch));
    }

    // Filter
    if (statusFilter !== 'All') {
      result = result.filter(sub => sub.status === statusFilter);
    }

    // Sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        if (a[sortConfig.key!] < b[sortConfig.key!]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key!] > b[sortConfig.key!]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [search, statusFilter, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = processedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Status Badge Helper
  const getStatusBadge = (status: SubscriberStatus) => {
    switch (status) {
      case 'Active': return <Badge variant="success">Active</Badge>;
      case 'Cancelled': return <Badge variant="default">Cancelled</Badge>;
      case 'Past Due': return <Badge variant="error" title="Payment failed">Past Due</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleSort = (key: keyof Subscriber) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey: keyof Subscriber) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-emerald-500" /> : <ArrowDown className="w-4 h-4 text-emerald-500" />;
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Plan', 'Tier', 'Join Date', 'Renew Date', 'Status', 'Total Paid'];
    const csvContent = [
      headers.join(','),
      ...processedData.map(sub => `"${sub.name}","${sub.email}","${sub.plan}","${sub.tier}","${sub.joinDate}","${sub.renewDate}","${sub.status}","${sub.totalPaid}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'subscribers_export.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  return (
    <div className="space-y-3 sm:space-y-4 max-w-full overflow-x-hidden">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-between sm:items-end">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text"
                placeholder="Search by name or email..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-3 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors min-h-[44px]"
              />
            </div>
            <div className="w-full sm:w-48">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-3 pr-10 py-3 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors appearance-none min-h-[44px]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25rem' }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Past Due">Past Due</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-3 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto justify-center min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table / Cards */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Fan {getSortIcon('name')}</div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('plan')}>
                  <div className="flex items-center gap-2">Plan {getSortIcon('plan')}</div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('joinDate')}>
                  <div className="flex items-center gap-2">Dates {getSortIcon('joinDate')}</div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-2">Status {getSortIcon('status')}</div>
                </th>
                <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-right" onClick={() => handleSort('totalPaid')}>
                  <div className="flex items-center justify-end gap-2">Total Paid {getSortIcon('totalPaid')}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? paginatedData.map((sub, idx) => (
                <tr key={sub.id} className={`${idx !== paginatedData.length - 1 ? 'border-b border-gray-200 dark:border-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img className="w-10 h-10 rounded-full object-cover" src={sub.avatar} alt={sub.name} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{sub.name}</div>
                        <div className="text-xs text-gray-500">{sub.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-900 dark:text-white font-medium">{sub.plan}</div>
                    <div className="text-xs text-gray-500">{sub.tier}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-900 dark:text-white">Joined: {sub.joinDate}</div>
                    <div className="text-xs text-gray-500">Renews: {sub.renewDate}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(sub.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900 dark:text-white">
                    ${sub.totalPaid.toFixed(2)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No subscribers found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          {paginatedData.length > 0 ? paginatedData.map((sub) => (
            <div key={sub.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img className="w-12 h-12 rounded-full object-cover" src={sub.avatar} alt={sub.name} />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{sub.name}</div>
                    <div className="text-sm text-gray-500">{sub.email}</div>
                  </div>
                </div>
                <div>
                  {getStatusBadge(sub.status)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Plan</div>
                  <div className="font-medium text-gray-900 dark:text-white">{sub.plan} <span className="text-gray-500 font-normal text-xs">({sub.tier})</span></div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Total Paid</div>
                  <div className="font-medium text-gray-900 dark:text-white">${sub.totalPaid.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Joined</div>
                  <div className="text-gray-900 dark:text-gray-300">{sub.joinDate}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">Renews</div>
                  <div className="text-gray-900 dark:text-gray-300">{sub.renewDate}</div>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              No subscribers found matching your criteria.
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 gap-3 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-400 text-center sm:text-left">
              Showing <span className="font-medium text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, processedData.length)}</span> of <span className="font-medium text-gray-900 dark:text-white">{processedData.length}</span> results
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 sm:p-1 rounded-md text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors min-w-[44px] min-h-[44px] sm:min-w-[auto] sm:min-h-[auto] flex items-center justify-center"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 sm:p-1 rounded-md text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-colors min-w-[44px] min-h-[44px] sm:min-w-[auto] sm:min-h-[auto] flex items-center justify-center"
                aria-label="Next Page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

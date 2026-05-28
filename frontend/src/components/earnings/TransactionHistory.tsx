'use client';

import React, { useEffect, useState } from 'react';
import { BaseCard } from '@/components/cards';
import { fetchTransactionHistory, type Transaction } from '@/lib/earnings-api';
import { transactionsToCSV, downloadCSV } from '@/lib/earnings-export';

interface TransactionHistoryProps {
  limit?: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  failed: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
};

const TYPE_ICONS: Record<string, string> = {
  subscription: '📅',
  post_purchase: '📄',
  tip: '💝',
  withdrawal: '💸',
  fee: '⚙️',
};

export function TransactionHistoryCard({ limit = 20 }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetchTransactionHistory(page, limit);
        setTransactions(response.items);
        setTotalPages(response.total_pages);
        setTotal(response.total);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [limit, page]);

  if (loading) {
    return (
      <BaseCard padding="lg" className="animate-pulse">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </BaseCard>
    );
  }

  if (error) {
    return (
      <BaseCard padding="lg" className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
        <p className="text-red-700 dark:text-red-200">{error}</p>
      </BaseCard>
    );
  }

  if (transactions.length === 0) {
    return (
      <BaseCard padding="lg" className="text-center">
        <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
      </BaseCard>
    );
  }

  const handleExport = async () => {
    try {
      setExporting(true);
      // Fetch all pages for a complete export
      const allItems: Transaction[] = [];
      let p = 1;
      let totalPages = 1;
      do {
        const res = await fetchTransactionHistory(p, 100);
        allItems.push(...res.items);
        totalPages = res.total_pages;
        p++;
      } while (p <= totalPages);

      const csv = transactionsToCSV(allItems);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `earnings-${date}.csv`);
    } catch {
      // silently fail; user can retry
    } finally {
      setExporting(false);
    }
  };

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <BaseCard padding="lg" as="section" aria-labelledby="transactions-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="transactions-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          Transaction History
        </h2>
        <button
          onClick={handleExport}
          disabled={exporting || transactions.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Export earnings as CSV"
        >
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-2 sm:gap-3"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xl flex-shrink-0">{TYPE_ICONS[tx.type] || '💰'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tx.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(tx.date).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-col sm:items-end">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {tx.amount} {tx.currency}
              </p>
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[tx.status] || 'bg-gray-100'}`}>
                {tx.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 gap-3 sm:gap-0">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Showing {startItem} - {endItem} of {total}
        </span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Next
        </button>
      </div>
    </BaseCard>
  );
}

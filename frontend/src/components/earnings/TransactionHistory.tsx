'use client';

import React, { useEffect, useState } from 'react';
import { BaseCard } from '@/components/cards';
import { fetchTransactionHistory, type Transaction } from '@/lib/earnings-api';

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
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchTransactionHistory(limit, offset);
        setTransactions(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [limit, offset]);

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

  return (
    <BaseCard padding="lg" as="section" aria-labelledby="transactions-heading">
      <h2 id="transactions-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Transaction History
      </h2>

      <div className="space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xl">{TYPE_ICONS[tx.type] || '💰'}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(tx.date).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {tx.amount} {tx.currency}
                </p>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[tx.status] || 'bg-gray-100'}`}>
                  {tx.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setOffset(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Showing {offset + 1} - {offset + transactions.length}
        </span>
        <button
          onClick={() => setOffset(offset + limit)}
          disabled={transactions.length < limit}
          className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Next
        </button>
      </div>
    </BaseCard>
  );
}

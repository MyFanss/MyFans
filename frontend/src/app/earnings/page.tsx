'use client';

import React, { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorFallback } from '@/components/ErrorFallback';
import {
  EarningsSummaryCard,
  EarningsBreakdownCard,
  TransactionHistoryCard,
  WithdrawalUI,
  FeeTransparencyCard,
  EarningsChart,
} from '@/components/earnings';
import { fetchEarningsSummary, type EarningsSummary } from '@/lib/earnings-api';
import { createAppError } from '@/types/errors';

export default function EarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchEarningsSummary(days);
        setSummary(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load earnings'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [days]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Earnings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track your revenue and manage withdrawals</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Selector */}
        <div className="mb-6 flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Error Boundary */}
        <ErrorBoundary fallback={<ErrorFallback error={createAppError('UNKNOWN_ERROR', { message: 'An error occurred' })} />}>
          {/* Summary Section */}
          <section className="mb-8">
            <EarningsSummaryCard days={days} />
          </section>

          {/* Charts Section */}
          <section className="mb-8">
            <EarningsChart />
          </section>

          {/* Breakdown Section */}
          <section className="mb-8">
            <EarningsBreakdownCard days={days} />
          </section>

          {/* Withdrawal & Fees Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Withdrawal */}
            <div className="lg:col-span-2">
              {summary && (
                <WithdrawalUI
                  availableBalance={summary.available_for_withdrawal}
                  currency={summary.currency}
                />
              )}
            </div>

            {/* Fee Transparency */}
            <div>
              <FeeTransparencyCard />
            </div>
          </div>

          {/* Transaction History */}
          <section className="mb-8">
            <TransactionHistoryCard limit={20} />
          </section>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">About Earnings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your earnings are calculated in real-time and updated as subscriptions are processed.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Support</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Contact Support</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">API Reference</a></li>
                <li><a href="#" className="hover:text-gray-900 dark:hover:text-white">Status Page</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 mt-8 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>&copy; 2024 MyFans. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

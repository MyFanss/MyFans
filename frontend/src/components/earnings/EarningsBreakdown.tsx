'use client';

import React, { useEffect, useState } from 'react';
import { BaseCard } from '@/components/cards';
import { fetchEarningsBreakdown, type EarningsBreakdown } from '@/lib/earnings-api';

interface EarningsBreakdownProps {
  days?: number;
}

export function EarningsBreakdownCard({ days = 30 }: EarningsBreakdownProps) {
  const [breakdown, setBreakdown] = useState<EarningsBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'time' | 'plan' | 'asset'>('time');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchEarningsBreakdown(days);
        setBreakdown(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load breakdown');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [days]);

  if (loading) {
    return (
      <BaseCard padding="lg" className="animate-pulse">
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
      </BaseCard>
    );
  }

  if (error || !breakdown) {
    return (
      <BaseCard padding="lg" className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
        <p className="text-red-700 dark:text-red-200">{error || 'Failed to load breakdown'}</p>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="lg" as="section" aria-labelledby="breakdown-heading">
      <h2 id="breakdown-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Earnings Breakdown
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['time', 'plan', 'asset'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'time' ? 'By Time' : tab === 'plan' ? 'By Plan' : 'By Asset'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        {activeTab === 'time' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Date</th>
                <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Amount</th>
                <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.by_time.map((row) => (
                <tr key={row.date} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3 px-2 text-gray-900 dark:text-white">{new Date(row.date).toLocaleDateString()}</td>
                  <td className="py-3 px-2 text-right text-gray-900 dark:text-white font-medium">
                    {row.amount} {row.currency}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'plan' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Plan</th>
                <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Total</th>
                <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Subscribers</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.by_plan.map((row) => (
                <tr key={row.plan_id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">{row.plan_name}</td>
                  <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
                    {row.total_amount} {row.currency}
                  </td>
                  <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">{row.subscriber_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'asset' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Asset</th>
                <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Amount</th>
                <th className="text-right py-2 px-2 text-gray-600 dark:text-gray-400 font-medium">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.by_asset.map((row) => (
                <tr key={row.asset} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">{row.asset}</td>
                  <td className="py-3 px-2 text-right text-gray-900 dark:text-white">{row.total_amount}</td>
                  <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">{row.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </BaseCard>
  );
}

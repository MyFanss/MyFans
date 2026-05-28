'use client';

import React, { useEffect, useState } from 'react';
import { BaseCard } from '@/components/cards';
import { fetchEarningsSummary, type EarningsSummary } from '@/lib/earnings-api';
import { createAppError } from '@/types/errors';

interface EarningsSummaryProps {
  days?: number;
}

export function EarningsSummaryCard({ days = 30 }: EarningsSummaryProps) {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchEarningsSummary(days);
        setSummary(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load earnings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [days]);

  if (loading) {
    return (
      <BaseCard padding="lg" className="animate-pulse">
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </BaseCard>
    );
  }

  if (error || !summary) {
    return (
      <BaseCard padding="lg" className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
        <p className="text-red-700 dark:text-red-200">{error || 'Failed to load earnings'}</p>
      </BaseCard>
    );
  }

  const stats = [
    {
      label: 'Total Earnings',
      value: `${summary.total_earnings} ${summary.currency}`,
      subtext: `≈ $${summary.total_earnings_usd.toFixed(2)} USD`,
    },
    {
      label: 'Pending',
      value: `${summary.pending_amount} ${summary.currency}`,
      subtext: 'Awaiting confirmation',
    },
    {
      label: 'Available for Withdrawal',
      value: `${summary.available_for_withdrawal} ${summary.currency}`,
      subtext: 'Ready to withdraw',
      highlight: true,
    },
  ];

  return (
    <BaseCard padding="lg" as="section" aria-labelledby="earnings-summary-heading">
      <h2 id="earnings-summary-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Earnings Summary
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`p-4 rounded-lg border ${
              stat.highlight
                ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
            }`}
          >
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.highlight ? 'text-green-700 dark:text-green-300' : 'text-gray-900 dark:text-white'}`}>
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{stat.subtext}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Period: {new Date(summary.period_start).toLocaleDateString()} - {new Date(summary.period_end).toLocaleDateString()}
      </div>
    </BaseCard>
  );
}

'use client';

import React, { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DashboardSectionBoundary } from '@/components/dashboard';
import {
  EarningsSummaryCard,
  EarningsChartSkeleton,
} from '@/components/earnings';

const EarningsChart = dynamic(
  () => import('@/components/earnings/EarningsChart').then((m) => m.EarningsChart),
  { loading: () => <EarningsChartSkeleton />, ssr: false },
);

function WithdrawalCtaStub({ availableHint }: { availableHint?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Withdrawals</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {availableHint
            ? `Request a payout when you are ready. ${availableHint}`
            : 'Request a payout from your available balance when you are ready.'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Full withdrawal flow is available on the earnings workspace (stub CTA).
        </p>
      </div>
      <Link
        href="/earnings#withdraw"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
      >
        Withdraw
      </Link>
    </div>
  );
}

export default function DashboardEarningsPage() {
  const [days, setDays] = useState(30);

  return (
    <div className="max-w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Earnings</h1>
        <div className="flex gap-2" role="group" aria-label="Summary period">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <DashboardSectionBoundary label="Earnings summary">
        <EarningsSummaryCard days={days} />
      </DashboardSectionBoundary>

      <DashboardSectionBoundary label="Earnings chart">
        <Suspense fallback={<EarningsChartSkeleton />}>
          <EarningsChart />
        </Suspense>
      </DashboardSectionBoundary>

      <DashboardSectionBoundary label="Withdrawals">
        <WithdrawalCtaStub />
      </DashboardSectionBoundary>
    </div>
  );
}

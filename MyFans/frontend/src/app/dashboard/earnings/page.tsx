'use client';

import React, { useState, useEffect } from 'react';
import { EarningsSummaryCard } from '@/components/earnings/EarningsSummary';
import { EarningsChart } from '@/components/earnings/EarningsChart';
import { EarningsBreakdownCard } from '@/components/earnings/EarningsBreakdown';
import { TransactionHistoryCard } from '@/components/earnings/TransactionHistory';
import { WithdrawalUI } from '@/components/earnings/WithdrawalUI';
import { fetchEarningsSummary, type EarningsSummary } from '@/lib/earnings-api';

export default function EarningsPage() {
  const [earningsData, setEarningsData] = useState<EarningsSummary | null>(null);

  useEffect(() => {
    const loadEarnings = async () => {
      try {
        const data = await fetchEarningsSummary(30);
        setEarningsData(data);
      } catch (error) {
        console.error('Failed to load earnings data:', error);
      }
    };
    loadEarnings();
  }, []);

  return (
    <div className="max-w-full space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-bold">Earnings</h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Track your revenue, view trends, and manage your earnings.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6">
        <EarningsSummaryCard days={30} />
      </div>

      {/* Chart and Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EarningsChart />
        </div>
        <div className="lg:col-span-1">
          <EarningsBreakdownCard days={30} />
        </div>
      </div>

      {/* Transaction History and Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionHistoryCard limit={10} />
        {earningsData && (
          <WithdrawalUI 
            availableBalance={earningsData.available_for_withdrawal}
            currency={earningsData.currency}
          />
        )}
      </div>
    </div>
  );
}

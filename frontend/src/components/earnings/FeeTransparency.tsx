'use client';

import React, { useEffect, useState } from 'react';
import { BaseCard } from '@/components/cards';
import { fetchFeeTransparency, type FeeTransparency } from '@/lib/earnings-api';

export function FeeTransparencyCard() {
  const [fees, setFees] = useState<FeeTransparency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchFeeTransparency();
        setFees(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fee info');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <BaseCard padding="lg" className="animate-pulse">
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </BaseCard>
    );
  }

  if (error || !fees) {
    return (
      <BaseCard padding="lg" className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950">
        <p className="text-red-700 dark:text-red-200">{error || 'Failed to load fee information'}</p>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="lg" as="section" aria-labelledby="fees-heading">
      <h2 id="fees-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Fee Transparency
      </h2>

      <div className="space-y-6">
        {/* Fee Structure */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Fee Structure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Protocol Fee</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {fees.protocol_fee_bps} bps ({fees.protocol_fee_percentage.toFixed(2)}%)
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Charged on each subscription payment</p>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Withdrawal Fee</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {fees.withdrawal_fee_fixed} + {fees.withdrawal_fee_percentage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Fixed + percentage on withdrawals</p>
            </div>
          </div>
        </div>

        {/* Example Calculation */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Example Calculation</h3>
          <div className="space-y-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Earnings</span>
              <span className="font-medium text-gray-900 dark:text-white">${fees.example_earnings}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Protocol Fee ({fees.protocol_fee_percentage.toFixed(2)}%)</span>
              <span className="font-medium text-red-600 dark:text-red-400">-${fees.example_protocol_fee}</span>
            </div>
            <div className="border-t border-blue-200 dark:border-blue-800 pt-2 flex justify-between text-sm font-semibold">
              <span className="text-gray-900 dark:text-white">Net Earnings</span>
              <span className="text-gray-900 dark:text-white">${fees.example_net_earnings}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">When withdrawing:</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Withdrawal Fee</span>
                <span className="font-medium text-red-600 dark:text-red-400">-${fees.example_withdrawal_fee}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold mt-2">
                <span className="text-gray-900 dark:text-white">Final Amount</span>
                <span className="text-green-600 dark:text-green-400">${fees.example_final_amount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            💡 Fees are transparent and deducted automatically. Protocol fees support platform maintenance and development.
          </p>
        </div>
      </div>
    </BaseCard>
  );
}

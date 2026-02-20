'use client';

import { Suspense, useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { EarningsChart } from '@/components/earnings';
import { EarningsChartSkeleton } from '@/components/earnings/EarningsChartSkeleton';

export default function CreatorsPage() {
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('30');

  const handleCreatePlan = async () => {
    alert(`Plan created: ${amount} ${asset} every ${days} days`);
  };

  return (
    <div className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Creator Dashboard</h1>
        <WalletConnect />
      </header>

      <section className="mb-10" aria-label="Earnings">
        <Suspense fallback={<EarningsChartSkeleton />}>
          <EarningsChart />
        </Suspense>
      </section>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl mb-4">Create Subscription Plan</h2>
        
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Asset (e.g., USDC address)"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full p-2 border rounded"
          />
          
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 border rounded"
          />
          
          <input
            type="number"
            placeholder="Interval (days)"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full p-2 border rounded"
          />
          
          <button
            onClick={handleCreatePlan}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded"
          >
            Create Plan
          </button>
        </div>
      </div>
    </div>
  );
}

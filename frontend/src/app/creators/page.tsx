'use client';

import { Suspense } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { EarningsChart } from '@/components/earnings';
import { EarningsChartSkeleton } from '@/components/earnings/EarningsChartSkeleton';
import { SubscriptionPlanForm } from '@/components/plan';

export default function CreatorsPage() {
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

      <section className="max-w-5xl mx-auto" aria-label="Create or edit subscription plan">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Create subscription plan</h2>
        <SubscriptionPlanForm
          onSave={async (values) => {
            console.log('Save draft', values);
          }}
          onPublish={async (values) => {
            console.log('Publish', values);
            // Replace with real API / on-chain call
          }}
        />
      </section>
    </div>
  );
}

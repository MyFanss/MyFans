'use client';

import { Suspense } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { EarningsChart } from '@/components/earnings';
import { EarningsChartSkeleton } from '@/components/earnings/EarningsChartSkeleton';
import { SubscriptionPlanForm } from '@/components/plan';
import { ContentLibrary } from '@/components/content-library';

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

      <section className="max-w-5xl mx-auto mb-10" aria-label="Create or edit subscription plan">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Create subscription plan</h2>
        <SubscriptionPlanForm
          onSave={async (values) => {
            console.log('Save draft', values);
          }}
          onPublish={async (values) => {
            console.log('Publish', values);
          }}
        />
      </section>

      <section className="max-w-6xl mx-auto" aria-label="Content library">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Content library</h2>
        <ContentLibrary
          onUpload={async (files) => {
            console.log('Upload', files.map((f) => f.name));
          }}
          onBulkDelete={async (ids) => {
            console.log('Bulk delete', ids);
          }}
          onBulkArchive={async (ids) => {
            console.log('Bulk archive', ids);
          }}
        />
      </section>
    </div>
  );
}

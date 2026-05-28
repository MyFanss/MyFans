'use client';
import { useState, useId } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';
import { CreatorListSkeleton } from '@/components/skeletons';

type PlanState = 'idle' | 'loading' | 'success' | 'error';

function CreatorDashboardContent() {
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('30');
  const [planState, setPlanState] = useState<PlanState>('idle');
  const [isLoadingCreators, setIsLoadingCreators] = useState(false);
  const assetId = useId();
  const amountId = useId();
  const daysId = useId();
  const statusId = useId();

  const handleCreatePlan = async () => {
    if (!asset.trim() || !amount.trim()) return;
    setPlanState('loading');
    try {
      await new Promise((r) => setTimeout(r, 500));
      setPlanState('success');
      setAsset('');
      setAmount('');
      setDays('30');
    } catch {
      setPlanState('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <section aria-labelledby="create-plan-heading">
        <h2 id="create-plan-heading" className="text-xl mb-4">
          Create Subscription Plan
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor={assetId} className="block text-sm font-medium mb-1">
              Asset (e.g., USDC address)
            </label>
            <input
              id={assetId}
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={amountId} className="block text-sm font-medium mb-1">
              Amount
            </label>
            <input
              id={amountId}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={daysId} className="block text-sm font-medium mb-1">
              Interval (days)
            </label>
            <input
              id={daysId}
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleCreatePlan}
            disabled={!asset.trim() || !amount.trim() || planState === 'loading'}
            aria-busy={planState === 'loading'}
            aria-describedby={statusId}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {planState === 'loading' ? 'Creating…' : 'Create Plan'}
          </button>

          <div id={statusId} role="status" aria-live="polite" className="text-sm">
            {planState === 'success' && (
              <p className="text-green-600">✓ Plan created successfully!</p>
            )}
            {planState === 'error' && (
              <p role="alert" className="text-red-600">
                Failed to create plan. Please try again.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Creator list with skeleton */}
      <section aria-labelledby="creators-list-heading" className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 id="creators-list-heading" className="text-xl">All Creators</h2>
          <button
            onClick={() => { setIsLoadingCreators(true); setTimeout(() => setIsLoadingCreators(false), 1500); }}
            className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Refresh
          </button>
        </div>
        {isLoadingCreators ? (
          <CreatorListSkeleton count={3} />
        ) : (
          <p className="text-sm text-gray-500">No creators yet.</p>
        )}
      </section>
    </div>
  );
}

export default function CreatorsPage() {
  return (
    <div className="min-h-screen p-8">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
      >
        Skip to main content
      </a>

      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Creator Dashboard</h1>
        <WalletConnect />
      </header>

      <main id="main-content">
        <ErrorBoundary section="creator-dashboard">
          <CreatorDashboardContent />
        </ErrorBoundary>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { MetricCard } from '@/components/cards';
import { ChartSkeleton, EmptyState, SuccessAnimation, TableSkeleton } from '@/components/ui/states';

interface MetricItem {
  title: string;
  value: string | number;
  valuePrefix?: string;
  changePercent?: number;
  trend: 'up' | 'down' | 'neutral';
}

interface Transaction {
  id: string;
  fan: string;
  amount: string;
  date: string;
}

export default function CreatorsPage() {
  const [asset, setAsset] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('30');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(true);

  const [metrics] = useState<MetricItem[]>([
    { title: 'Monthly Revenue', value: 0, valuePrefix: '$', changePercent: 0, trend: 'neutral' },
    { title: 'Active Fans', value: 0, changePercent: 0, trend: 'neutral' },
    { title: 'Renewal Rate', value: 0, valuePrefix: '', changePercent: 0, trend: 'neutral' },
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartPoints, setChartPoints] = useState<number[]>([]);

  useEffect(() => {
    const metricsTimer = setTimeout(() => setIsLoadingMetrics(false), 900);
    const transactionsTimer = setTimeout(() => setIsLoadingTransactions(false), 1300);
    const chartTimer = setTimeout(() => setIsLoadingChart(false), 1100);

    return () => {
      clearTimeout(metricsTimer);
      clearTimeout(transactionsTimer);
      clearTimeout(chartTimer);
    };
  }, []);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 2400);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const handleCreatePlan = async () => {
    if (!amount || Number(amount) <= 0) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setIsSubmitting(false);
    setShowSuccess(true);
    setTransactions((current) => [
      {
        id: `sub_${Date.now()}`,
        fan: 'New subscriber',
        amount: `$${Number(amount).toFixed(2)} ${asset}`,
        date: 'Just now',
      },
      ...current,
    ]);
    if (chartPoints.length === 0) {
      setChartPoints([24, 45, 39, 58, 61, 56, 72]);
    }
    setAmount('');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Creator Dashboard</h1>
        <WalletConnect />
      </header>

      <div className="mx-auto max-w-5xl space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Performance Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard
                changePercent={metric.changePercent}
                comparisonLabel="vs last month"
                isLoading={isLoadingMetrics}
                key={metric.title}
                title={metric.title}
                trend={metric.trend}
                value={metric.value}
                valuePrefix={metric.valuePrefix}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Revenue Trend</h2>
          {isLoadingChart ? (
            <ChartSkeleton />
          ) : chartPoints.length === 0 ? (
            <EmptyState
              ctaLabel="Publish your first offer"
              description="Revenue analytics appears after your first subscription payment."
              onCtaClick={() => setChartPoints([14, 26, 34, 22, 41, 59, 63])}
              title="No chart data yet"
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-600">Last 7 days revenue (USD)</p>
              <div className="mt-4 flex h-44 items-end gap-2">
                {chartPoints.map((point, index) => (
                  <div
                    className="rounded-t-md bg-gradient-to-t from-sky-500 to-sky-300"
                    key={`${point}-${index}`}
                    style={{ height: `${point}%`, width: `${100 / chartPoints.length}%` }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
          </div>
          {isLoadingTransactions ? (
            <TableSkeleton rows={5} />
          ) : transactions.length === 0 ? (
            <EmptyState
              ctaLabel="Create your first plan"
              description="Transactions will appear after a fan subscribes."
              title="No transactions yet"
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Fan</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((item) => (
                    <tr className="border-t border-slate-200" key={item.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.id.slice(0, 14)}...</td>
                      <td className="px-4 py-3">{item.fan}</td>
                      <td className="px-4 py-3">{item.amount}</td>
                      <td className="px-4 py-3">{item.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Create Subscription Plan</h2>
          <p className="mt-1 text-sm text-slate-600">Set your pricing and start monetizing content.</p>

          <div className="mt-5 space-y-4">
            <input
              className="w-full rounded border border-slate-300 p-2"
              onChange={(e) => setAsset(e.target.value)}
              placeholder="Asset (e.g., USDC)"
              type="text"
              value={asset}
            />

            <input
              className="w-full rounded border border-slate-300 p-2"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              type="number"
              value={amount}
            />

            <input
              className="w-full rounded border border-slate-300 p-2"
              onChange={(e) => setDays(e.target.value)}
              placeholder="Interval (days)"
              type="number"
              value={days}
            />

            <button
              className="w-full rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={isSubmitting || !amount || Number(amount) <= 0}
              onClick={handleCreatePlan}
              type="button"
            >
              {isSubmitting ? 'Creating plan...' : 'Create Plan'}
            </button>
          </div>

          {showSuccess ? (
            <div className="mt-4">
              <SuccessAnimation message="Plan created successfully" />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

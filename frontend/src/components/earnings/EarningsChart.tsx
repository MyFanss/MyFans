'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BaseCard } from '@/components/cards';
import {
  fetchEarnings,
  EARNINGS_RANGE_OPTIONS,
  type EarningsTimeRange,
  type EarningsDataPoint,
} from '@/lib/earnings';
import { EarningsChartSkeleton } from './EarningsChartSkeleton';

const CHART_HEIGHT = 280;

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(m.matches);
    const fn = () => setDark(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return dark;
}

export function EarningsChart() {
  const searchParams = useSearchParams();
  const isDark = usePrefersDark();

  const rangeFromUrl = searchParams.get('range');
  const initialRange: EarningsTimeRange =
    rangeFromUrl === '7d' || rangeFromUrl === '30d' || rangeFromUrl === '90d' ? rangeFromUrl : '30d';

  const [range, setRangeState] = useState<EarningsTimeRange>(initialRange);
  const [state, setState] = useState<'loading' | 'success' | 'empty'>('loading');
  const [data, setData] = useState<EarningsDataPoint[]>([]);

  const setRange = useCallback(
    (next: EarningsTimeRange) => {
      setRangeState(next);
      const url = new URL(window.location.href);
      url.searchParams.set('range', next);
      window.history.replaceState({}, '', url.toString());
    },
    []
  );

  useEffect(() => {
    const urlRange = searchParams.get('range');
    if (urlRange === '7d' || urlRange === '30d' || urlRange === '90d') {
      setRangeState(urlRange);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const result = await fetchEarnings(range);
      setData(result.data);
      setState(result.data.length === 0 ? 'empty' : 'success');
    } catch {
      setState('empty');
      setData([]);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const chartColors = useMemo(
    () => ({
      bar: isDark ? '#38bdf8' : '#0284c7',
      grid: isDark ? '#374151' : '#e5e7eb',
      text: isDark ? '#9ca3af' : '#6b7280',
    }),
    [isDark]
  );

  if (state === 'loading') {
    return <EarningsChartSkeleton />;
  }

  if (state === 'empty' || data.length === 0) {
    return (
      <BaseCard className="flex flex-col items-center justify-center text-center" padding="lg">
        <div
          className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4"
          aria-hidden
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No earnings data</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          Earnings for the selected period will appear here once you have activity.
        </p>
      </BaseCard>
    );
  }

  return (
    <BaseCard className="flex flex-col" padding="lg" as="section" aria-labelledby="earnings-chart-heading">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 id="earnings-chart-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          Earnings
        </h2>
        <div
          role="tablist"
          aria-label="Time range"
          className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800"
        >
          {EARNINGS_RANGE_OPTIONS.map((opt, index) => (
            <button
              key={opt.value}
              role="tab"
              aria-selected={range === opt.value}
              aria-controls="earnings-chart-panel"
              id={`earnings-tab-${opt.value}`}
              tabIndex={range === opt.value ? 0 : -1}
              onClick={() => setRange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' && index > 0) {
                  e.preventDefault();
                  setRange(EARNINGS_RANGE_OPTIONS[index - 1].value);
                }
                if (e.key === 'ArrowRight' && index < EARNINGS_RANGE_OPTIONS.length - 1) {
                  e.preventDefault();
                  setRange(EARNINGS_RANGE_OPTIONS[index + 1].value);
                }
                if (e.key === 'Home') {
                  e.preventDefault();
                  setRange(EARNINGS_RANGE_OPTIONS[0].value);
                }
                if (e.key === 'End') {
                  e.preventDefault();
                  setRange(EARNINGS_RANGE_OPTIONS[EARNINGS_RANGE_OPTIONS.length - 1].value);
                }
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                range === opt.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div id="earnings-chart-panel" role="tabpanel" aria-labelledby={`earnings-tab-${range}`}>
        <div className="h-[280px] w-full" style={{ minHeight: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: chartColors.text, fontSize: 12 }}
                axisLine={{ stroke: chartColors.grid }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chartColors.text, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1f2937' : '#fff',
                  border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                formatter={(value: number | undefined) => [`$${value != null ? value.toFixed(2) : '0.00'}`, 'Earnings']}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="earnings" fill={chartColors.bar} radius={[4, 4, 0, 0]} name="Earnings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table fallback for a11y */}
      <div className="sr-only">
        <table>
          <caption>Earnings by date for {EARNINGS_RANGE_OPTIONS.find((o) => o.value === range)?.label}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Earnings ($)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.date}>
                <td>{row.label}</td>
                <td>{row.earnings.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}

export default EarningsChart;

/**
 * Earnings chart types and data from API with fallback to mock on error.
 */

import { fetchEarningsBreakdown, type EarningsBreakdown } from '@/lib/earnings-api';

export type EarningsTimeRange = '7d' | '30d' | '90d';

export interface EarningsDataPoint {
  date: string; // YYYY-MM-DD
  earnings: number;
  label: string; // e.g. "Feb 15" for a11y/table
}

export interface EarningsSeries {
  range: EarningsTimeRange;
  data: EarningsDataPoint[];
}

function rangeToDays(range: EarningsTimeRange): number {
  return range === '7d' ? 7 : range === '30d' ? 30 : 90;
}

function generateMockData(range: EarningsTimeRange): EarningsDataPoint[] {
  const days = rangeToDays(range);
  const data: EarningsDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const earnings = Math.round((Math.random() * 80 + 20) * 100) / 100;
    data.push({ date: dateStr, earnings, label });
  }
  return data;
}

function mapBreakdownToPoints(breakdown: EarningsBreakdown): EarningsDataPoint[] {
  return (breakdown.by_time ?? []).map((row) => {
    const date = row.date.slice(0, 10);
    const parsed = new Date(date);
    const label = Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const earnings = Number.parseFloat(row.amount);
    return {
      date,
      earnings: Number.isFinite(earnings) ? earnings : 0,
      label,
    };
  });
}

/**
 * Fetch earnings for a time range from API, with fallback to mock on error.
 */
export async function fetchEarnings(range: EarningsTimeRange): Promise<EarningsSeries> {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  try {
    const breakdown = await fetchEarningsBreakdown(days);

    const data: EarningsDataPoint[] = breakdown.by_time.map((item) => ({
      date: item.date,
      earnings: parseFloat(item.amount),
      label: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    return {
      range,
      data,
    };
  } catch {
    // Fall back to mock data on error
    return {
      range,
      data: generateMockData(range),
    };
  }
}

export const EARNINGS_RANGE_OPTIONS: { value: EarningsTimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

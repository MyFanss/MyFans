/**
 * Earnings chart types and API-backed series fetch.
 */

import {
  fetchEarningsBreakdown,
  type EarningsBreakdown,
} from '@/lib/earnings-api';

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
 * Fetch earnings chart series for a time range from the earnings API.
 * Empty arrays are valid (no mock fallback).
 */
export async function fetchEarnings(range: EarningsTimeRange): Promise<EarningsSeries> {
  const breakdown = await fetchEarningsBreakdown(rangeToDays(range));
  return {
    range,
    data: mapBreakdownToPoints(breakdown),
  };
}

export const EARNINGS_RANGE_OPTIONS: { value: EarningsTimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

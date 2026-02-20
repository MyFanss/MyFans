/**
 * Earnings chart types and data (API or mock).
 */

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

function generateMockData(range: EarningsTimeRange): EarningsDataPoint[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
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

/**
 * Fetch earnings for a time range. Replace with real API when available.
 */
export async function fetchEarnings(range: EarningsTimeRange): Promise<EarningsSeries> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    range,
    data: generateMockData(range),
  };
}

export const EARNINGS_RANGE_OPTIONS: { value: EarningsTimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

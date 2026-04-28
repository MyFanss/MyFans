import { EarningsSummaryCard } from '@/components/earnings/EarningsSummary';
import { EarningsBreakdownCard } from '@/components/earnings/EarningsBreakdown';

export default function EarningsPage() {
  return (
    <div className="max-w-full space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Earnings</h1>
      <EarningsSummaryCard />
      <EarningsBreakdownCard />
    </div>
  );
}

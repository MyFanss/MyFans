import { redirect } from 'next/navigation';
import SubscribeConfirmationFlow from '@/components/subscribe/SubscribeConfirmationFlow';
import type { SubscriptionPlan } from '@/types/subscribe';
import { getCreatorPlanById } from '@/lib/creator-plans-api';
import { getAssetByContractId } from '@/lib/assets';

function getIntervalLabel(intervalDays: number): 'monthly' | 'yearly' | 'one-time' {
  if (intervalDays === 30) return 'monthly';
  if (intervalDays === 365) return 'yearly';
  return 'one-time';
}

export default async function SubscribeConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorId: string }>;
  searchParams: Promise<{ planId?: string }>;
}) {
  const { creatorId } = await params;
  const { planId: planIdStr } = await searchParams;
  const planId = planIdStr ? parseInt(planIdStr, 10) : 0;

  if (!creatorId || !planId) {
    redirect('/');
  }

  let plan: SubscriptionPlan = {
    id: planId,
    name: 'Plan',
    price: '0',
    currency: 'XLM',
    billingInterval: 'monthly',
    creatorName: creatorId,
    creatorAddress: creatorId,
  };

  try {
    const fetchedPlan = await getCreatorPlanById(creatorId, planId);

    if (fetchedPlan) {
      const asset = getAssetByContractId(fetchedPlan.asset);
      const assetDisplay = asset?.symbol || fetchedPlan.asset;

      plan = {
        id: fetchedPlan.id,
        name: assetDisplay,
        price: fetchedPlan.amount,
        currency: fetchedPlan.asset,
        billingInterval: getIntervalLabel(fetchedPlan.intervalDays),
        creatorName: creatorId,
        creatorAddress: creatorId,
      };
    }
  } catch {
    console.error(`Failed to fetch plan ${planId} for creator ${creatorId}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => history.back()}
          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          aria-label="Go back to profile"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold">Subscribe</h1>
      </div>
      <SubscribeConfirmationFlow plan={plan} />
    </div>
  );
}

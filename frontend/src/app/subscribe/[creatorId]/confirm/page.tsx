import SubscribeConfirmationFlow from '@/components/subscribe/SubscribeConfirmationFlow';
import type { SubscriptionPlan } from '@/types/subscribe';

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

  const plan: SubscriptionPlan = {
    id: planId,
    name: 'Premium Plan',
    price: '9.99',
    currency: 'XLM',
    billingInterval: 'monthly',
    creatorName: `Creator ${creatorId}`,
    creatorAddress: '',
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <h1 className="text-2xl font-semibold mb-6">Subscribe</h1>
      <SubscribeConfirmationFlow plan={plan} />
    </div>
  );
}

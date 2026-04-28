import { SubscriptionPlanForm } from '@/components/plan/SubscriptionPlanForm';

export default function PlansPage() {
  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Subscription Plans</h1>
      <SubscriptionPlanForm />
    </div>
  );
}

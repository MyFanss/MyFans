'use client';

import { useRouter } from 'next/navigation';
import { DashboardHome } from '@/components/dashboard';

/**
 * Thin client shell — the only reason this is a client component is the
 * router callbacks passed to DashboardHome (onCreatePlan / onUploadContent).
 *
 * Auth-z is enforced at two layers:
 *  1. RouteGuard (root layout): verifies is_creator + onboarding state;
 *     fans are redirected to /discover, incomplete creators to /onboarding.
 *  2. fetchDashboardData (lib/dashboard.ts): if the API returns 403 the
 *     error propagates through useDashboardData → DashboardHome renders
 *     DashboardError with a retry option instead of an empty/broken view.
 */
export default function DashboardOverview() {
  const router = useRouter();

  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Overview</h1>
      <DashboardHome
        onCreatePlan={() => router.push('/dashboard/plans')}
        onUploadContent={() => router.push('/dashboard/content')}
      />
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { DashboardHome } from '@/components/dashboard';

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

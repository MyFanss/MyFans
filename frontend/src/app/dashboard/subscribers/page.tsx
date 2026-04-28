import React from 'react';
import SubscribersTable from '@/components/dashboard/SubscribersTable';
import { DashboardSectionBoundary } from '@/components/dashboard';

export default function SubscribersPage() {
  return (
    <div className="max-w-full">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Subscribers</h1>
      <DashboardSectionBoundary label="Subscribers table">
        <SubscribersTable />
      </DashboardSectionBoundary>
    </div>
  );
}

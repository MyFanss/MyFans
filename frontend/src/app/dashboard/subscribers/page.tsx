import React from 'react';
import SubscribersTable from '@/components/dashboard/SubscribersTable';

export default function SubscribersPage() {
  return (
    <div className="max-w-full overflow-x-hidden">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Subscribers</h1>
      <SubscribersTable />
    </div>
  );
}

import { Suspense } from 'react';
import SubscribeView from './SubscribeView';

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 p-8 text-slate-600">Loading subscribe…</div>
      }
    >
      <SubscribeView />
    </Suspense>
  );
}

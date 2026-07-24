import { Suspense } from 'react';
import SubscribeView from './SubscribeView';

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-600">
          Loading subscribe page…
        </div>
      }
    >
      <SubscribeView />
    </Suspense>
  );
}

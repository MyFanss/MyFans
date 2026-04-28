'use client';

import { useEffect, useRef } from 'react';
import type { SubscriptionPlan } from '@/types/subscribe';

interface Props {
  plan: SubscriptionPlan;
  txHash: string;
  onViewContent: () => void;
}

export default function SubscribeSuccessView({ plan, txHash, onViewContent }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div 
      className="flex flex-col items-center gap-6 py-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="flex flex-col gap-1">
        <h2 
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 focus:outline-none"
        >
          You are now subscribed
        </h2>
        <p className="text-sm text-slate-500">to {plan.creatorName}</p>
      </div>

      <p className="max-w-xs break-all text-xs text-slate-400">
        Tx: <span aria-label={`Transaction hash: ${txHash}`}>{txHash}</span>
      </p>

      <button
        onClick={onViewContent}
        className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        View Content
      </button>
    </div>
  );
}

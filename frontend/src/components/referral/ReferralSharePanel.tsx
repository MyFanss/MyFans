'use client';

import { useState } from 'react';

interface ReferralSharePanelProps {
  code: string;
  useCount: number;
  maxUses: number | null;
}

export function ReferralSharePanel({ code, useCount, maxUses }: ReferralSharePanelProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/onboarding?ref=${code}`
      : `/onboarding?ref=${code}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Your referral code</p>
      <p className="mb-3 text-2xl font-bold tracking-widest text-indigo-600">{code}</p>

      <div className="mb-3 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
        <span className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">{shareUrl}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy referral link"
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        {useCount} use{useCount !== 1 ? 's' : ''}
        {maxUses !== null ? ` / ${maxUses} max` : ' (unlimited)'}
      </p>
    </div>
  );
}

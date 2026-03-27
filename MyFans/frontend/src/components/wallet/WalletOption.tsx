'use client';

import type { WalletType } from '@/types/wallet';

interface WalletOptionProps {
  type: WalletType;
  name: string;
  description: string;
  icon: string;
  isConnecting: boolean;
  onSelect: () => void;
  disabled: boolean;
}

export function WalletOption({
  name,
  description,
  icon,
  isConnecting,
  onSelect,
  disabled,
}: WalletOptionProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left transition-all hover:border-primary-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-600"
      aria-busy={isConnecting}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-2xl dark:bg-slate-800">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">{name}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        {isConnecting && (
          <svg
            className="h-5 w-5 animate-spin text-primary-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

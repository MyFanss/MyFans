'use client';

import type { WalletType } from '@/types/wallet';

interface WalletOptionProps {
  type: WalletType;
  name: string;
  description: string;
  icon: string;
  isConnecting: boolean;
  isInstalled: boolean;
  installUrl?: string;
  onSelect: () => void;
  onInstall?: () => void;
  disabled: boolean;
}

export function WalletOption({
  name,
  description,
  icon,
  isConnecting,
  isInstalled,
  installUrl,
  onSelect,
  onInstall,
  disabled,
}: WalletOptionProps) {
  const showInstallButton = !isInstalled && installUrl && onInstall;
  
  return (
    <div className="relative">
      <button
        onClick={showInstallButton ? onInstall : onSelect}
        disabled={disabled || isConnecting}
        className={`w-full rounded-lg border p-4 text-left transition-all ${
          showInstallButton
            ? 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:border-amber-700 dark:hover:bg-amber-900/30'
            : 'border-slate-200 bg-white hover:border-primary-500 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-600'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        aria-busy={isConnecting}
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${
            showInstallButton
              ? 'bg-amber-100 dark:bg-amber-800'
              : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {name}
              {!isInstalled && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-200">
                  Not Installed
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {showInstallButton ? `Install ${name} to connect` : description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showInstallButton ? (
              <svg
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            ) : isConnecting ? (
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
            ) : (
              <svg
                className="h-5 w-5 text-slate-400 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </div>
        </div>
      </button>
      
      {/* Installation hint tooltip */}
      {showInstallButton && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="group relative">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white">
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="absolute right-0 top-8 hidden w-48 rounded-lg bg-slate-900 p-2 text-xs text-white shadow-lg group-hover:block dark:bg-slate-700">
              Click to install {name} wallet
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

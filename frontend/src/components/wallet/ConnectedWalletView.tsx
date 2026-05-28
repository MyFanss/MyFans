'use client';

import { useState } from 'react';
import type { WalletType } from '@/types/wallet';

interface ConnectedWalletViewProps {
  address: string;
  walletType: WalletType;
  network: string;
  onDisconnect: () => void;
}

export function ConnectedWalletView({
  address,
  walletType,
  network,
  onDisconnect,
}: ConnectedWalletViewProps) {
  const [copied, setCopied] = useState(false);

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'freighter':
        return '🚀';
      case 'lobstr':
        return '🦞';
      case 'walletconnect':
        return '🔗';
      default:
        return '💼';
    }
  };

  const getWalletName = (type: WalletType) => {
    switch (type) {
      case 'freighter':
        return 'Freighter';
      case 'lobstr':
        return 'Lobstr';
      case 'walletconnect':
        return 'WalletConnect';
      default:
        return 'Wallet';
    }
  };

  return (
    <div className="space-y-4">
      {/* Status announcement for screen readers */}
      <div className="sr-only" role="status" aria-live="polite">
        Wallet connected successfully
      </div>

      {/* Wallet info */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-xl dark:bg-slate-800">
            {getWalletIcon(walletType)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Connected to {getWalletName(walletType)}
              </span>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">{network}</p>
          </div>
        </div>
      </div>

      {/* Address display */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
        <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Wallet Address
        </label>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 font-mono text-sm text-slate-900 dark:text-white"
            aria-label={`Wallet address ${address}`}
          >
            {formatAddress(address)}
          </code>
          <button
            onClick={handleCopy}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label={copied ? 'Address copied' : 'Copy address'}
          >
            {copied ? (
              <svg
                className="h-5 w-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Disconnect button */}
      <button
        onClick={onDisconnect}
        className="w-full rounded-lg border border-red-200 bg-white px-4 py-3 font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-900/20"
        aria-label="Disconnect wallet"
      >
        Disconnect Wallet
      </button>
    </div>
  );
}

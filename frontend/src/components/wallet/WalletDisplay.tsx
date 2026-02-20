'use client';

import React, { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';

const truncateAddress = (addr: string, start = 6, end = 4) =>
  addr.length > start + end ? `${addr.slice(0, start)}...${addr.slice(-end)}` : addr;

const networkLabels: Record<string, string> = {
  PUBLIC: 'Mainnet',
  TESTNET: 'Testnet',
  FUTURENET: 'Futurenet',
  STANDALONE: 'Standalone',
};

export function WalletDisplay() {
  const { address, network, isConnected, extensionInstalled, error, connect, disconnect, refresh } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!extensionInstalled) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <p className="text-sm text-amber-600 dark:text-amber-400">Freighter extension not installed</p>
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-1 inline-block"
        >
          Install Freighter
        </a>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <button
          type="button"
          onClick={connect}
          className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 transition-colors"
        >
          Connect Wallet
        </button>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm truncate" title={address ?? ''}>
          {address ? truncateAddress(address) : '—'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Copy address"
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
      {network && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {networkLabels[network] ?? network}
        </p>
      )}
      <button
        type="button"
        onClick={disconnect}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 py-2 px-4 text-sm font-medium transition-colors"
      >
        Disconnect
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

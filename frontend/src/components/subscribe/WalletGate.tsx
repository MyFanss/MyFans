'use client';

import { useState, useEffect } from 'react';
import { isWalletInstalled, connectWallet } from '@/lib/wallet';

interface WalletGateProps {
  onConnected: (address: string) => void;
}

export default function WalletGate({ onConnected }: WalletGateProps) {
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWalletInstalled(isWalletInstalled('freighter'));
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const address = await connectWallet('freighter');
      if (address) {
        onConnected(address);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Still checking on mount
  if (walletInstalled === null) {
    return null;
  }

  // Freighter not installed
  if (!walletInstalled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
        <p className="mb-3 text-slate-700 dark:text-slate-300">
          Freighter wallet not found
        </p>
        <a
          href="https://freighter.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700"
        >
          Install Freighter
        </a>
      </div>
    );
  }

  // Freighter installed, not yet connected
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/50">
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="rounded-lg bg-primary-500 px-6 py-2.5 font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
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
            Connecting...
          </span>
        ) : (
          'Connect Wallet'
        )}
      </button>
    </div>
  );
}

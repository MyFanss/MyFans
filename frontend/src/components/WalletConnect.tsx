'use client';

import { useState, useCallback } from 'react';
import { connectWallet } from '@/lib/wallet';
import { useToast } from '@/components/ErrorToast';
import { useTransaction } from '@/hooks/useTransaction';
import type { AppError } from '@/types/errors';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
  className?: string;
}

export default function WalletConnect({
  onConnect,
  onDisconnect,
  className = '',
}: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const { showError } = useToast();

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const addr = await connectWallet();
      if (addr) {
        setAddress(addr);
        onConnect?.(addr);
      } else {
        // User rejected or wallet not found - error already shown by connectWallet
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      showError('WALLET_CONNECTION_FAILED', {
        message: errorMessage,
        description: 'Please make sure you have a compatible wallet installed and try again.',
      });
      setError({
        code: 'WALLET_CONNECTION_FAILED',
        message: errorMessage,
        severity: 'error',
        category: 'wallet',
        recoverable: true,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [onConnect, showError]);

  const handleDisconnect = useCallback(() => {
    setAddress(null);
    setError(null);
    onDisconnect?.();
  }, [onDisconnect]);

  const handleRetry = useCallback(() => {
    setError(null);
    handleConnect();
  }, [handleConnect]);

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <div className={`p-4 ${className}`}>
      {!address ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
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

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {error.message}
                  </p>
                  <button
                    onClick={handleRetry}
                    className="mt-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 dark:bg-green-900/20">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {formatAddress(address)}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

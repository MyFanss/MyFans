'use client';

import { useState } from 'react';
import { connectWalletLegacy } from '@/lib/wallet';

export interface WalletConnectProps {
  className?: string;
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export default function WalletConnect({
  className,
  onConnect,
  onDisconnect,
}: WalletConnectProps = {}) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const addr = await connectWalletLegacy();
      if (addr) {
        setAddress(addr);
        onConnect?.(addr);
      } else {
        setError('No address returned. Is Freighter installed?');
      }
    } catch {
      setError('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    onDisconnect?.();
  };

  return (
    <div className={className ?? 'p-4'}>
      {!address ? (
        <div>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            aria-busy={isConnecting}
            aria-label="Connect Stellar wallet"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div
            aria-label={`Wallet connected: ${address}`}
            className="text-sm font-mono"
          >
            Connected: {address.slice(0, 8)}…{address.slice(-8)}
          </div>
          {onDisconnect && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-sm text-slate-600 underline hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Demo component to showcase wallet session persistence
 */

'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import {
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
  isSessionStale,
  type WalletSessionData,
} from '@/lib/wallet-session';

export function WalletSessionDemo() {
  const { isConnected, address, walletType, connect, disconnect } = useWallet();
  const [sessionInfo, setSessionInfo] = useState<string>('');

  useEffect(() => {
    updateSessionInfo();
  }, [isConnected, address]);

  const updateSessionInfo = () => {
    const session = loadWalletSession();
    if (session) {
      const stale = isSessionStale(session);
      setSessionInfo(
        `Session found: ${session.address.slice(0, 8)}... (${stale ? 'stale' : 'fresh'})`
      );
    } else {
      setSessionInfo('No session found');
    }
  };

  const handleConnect = async () => {
    try {
      await connect('freighter');
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleClearSession = () => {
    clearWalletSession();
    updateSessionInfo();
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Wallet Session Demo</h2>
      
      <div className="space-y-4">
        <div className="p-3 bg-gray-100 rounded">
          <p className="text-sm font-medium">Connection Status:</p>
          <p className="text-lg">
            {isConnected ? `Connected: ${address?.slice(0, 8)}...` : 'Disconnected'}
          </p>
          {walletType && <p className="text-sm text-gray-600">Wallet: {walletType}</p>}
        </div>

        <div className="p-3 bg-blue-50 rounded">
          <p className="text-sm font-medium">Session Info:</p>
          <p className="text-sm">{sessionInfo}</p>
        </div>

        <div className="flex gap-2">
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Disconnect
            </button>
          )}
          
          <button
            onClick={handleClearSession}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Session
          </button>
        </div>

        <div className="text-xs text-gray-500">
          <p>• Connect a wallet to save session</p>
          <p>• Reload page to test persistence</p>
          <p>• Session expires after 24 hours</p>
        </div>
      </div>
    </div>
  );
}

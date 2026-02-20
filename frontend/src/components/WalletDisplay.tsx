'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Button from './Button';
import { cn } from '@/lib/utils';

interface WalletDisplayProps {
  address: string;
  network?: string;
  onDisconnect?: () => void | Promise<void>;
  className?: string;
}

export default function WalletDisplay({
  address,
  network = 'Stellar',
  onDisconnect,
  className,
}: WalletDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(true);

  // Check if wallet extension is available
  useEffect(() => {
    const checkExtension = () => {
      const isAvailable = typeof window !== 'undefined' && !!(window as any).freighter;
      setExtensionDetected(isAvailable);
    };

    checkExtension();

    // Listen for extension connection changes
    const handleExtensionChange = () => checkExtension();
    window.addEventListener('freighterLoaded', handleExtensionChange);

    return () => {
      window.removeEventListener('freighterLoaded', handleExtensionChange);
    };
  }, []);

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [address]);

  const handleDisconnect = useCallback(async () => {
    try {
      setIsDisconnecting(true);
      if (onDisconnect) {
        await onDisconnect();
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setIsDisconnecting(false);
    }
  }, [onDisconnect]);

  if (!extensionDetected) {
    return (
      <div
        className={cn(
          'p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800',
          className
        )}
        role="alert"
      >
        Wallet extension not detected. Please install Freighter.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3',
        className
      )}
    >
      {/* Network */}
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-600">Network:</span>
        <span className="text-sm text-gray-900 font-semibold">{network}</span>
      </div>

      {/* Address Section */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 mb-1">Address:</p>
          <p
            className="text-sm font-mono break-all text-gray-900"
            title={address}
            aria-label={`Wallet address: ${address}`}
          >
            {address}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyAddress}
          aria-label={copied ? 'Address copied' : 'Copy address to clipboard'}
          title="Copy address"
          disabled={isDisconnecting}
        >
          {copied ? (
            <svg
              className="w-4 h-4 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
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
        </Button>
      </div>

      {/* Disconnect Button */}
      <Button
        variant="tertiary"
        size="sm"
        onClick={handleDisconnect}
        isLoading={isDisconnecting}
        fullWidth
        aria-label="Disconnect wallet"
      >
        Disconnect
      </Button>
    </div>
  );
}

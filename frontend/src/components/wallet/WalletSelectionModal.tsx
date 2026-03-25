'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WalletOption } from './WalletOption';
import { ConnectedWalletView } from './ConnectedWalletView';
import type { WalletType, WalletConnectionState } from '@/types/wallet';

interface WalletSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (address: string, walletType: WalletType) => void;
  onDisconnect?: () => void;
}

export function WalletSelectionModal({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
}: WalletSelectionModalProps) {
  const [connectionState, setConnectionState] = useState<WalletConnectionState>({
    status: 'disconnected',
  });
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (connectionState.status === 'connecting') return;
    onClose();
  }, [connectionState.status, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus modal
    modalRef.current?.focus();

    // Handle Tab key for focus trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [handleClose, isOpen]);

  const handleWalletSelect = useCallback(async (walletType: WalletType) => {
    setConnectionState({ status: 'connecting', walletType });

    try {
      const address = await connectToWallet(walletType);
      
      setConnectionState({
        status: 'connected',
        address,
        walletType,
        network: 'Stellar Mainnet',
      });

      onConnect?.(address, walletType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setConnectionState({
        status: 'error',
        error: errorMessage,
        walletType,
      });
    }
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    setConnectionState({ status: 'disconnected' });
    onDisconnect?.();
  }, [onDisconnect]);

  const handleRetry = useCallback(() => {
    if (connectionState.status === 'error' && connectionState.walletType) {
      handleWalletSelect(connectionState.walletType);
    }
  }, [connectionState, handleWalletSelect]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
        role="document"
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2
            id="wallet-modal-title"
            className="text-xl font-semibold text-slate-900 dark:text-white"
          >
            {connectionState.status === 'connected' ? 'Connected Wallet' : 'Connect Wallet'}
          </h2>
          <button
            onClick={handleClose}
            disabled={connectionState.status === 'connecting'}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            aria-label="Close modal"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        {connectionState.status === 'connected' ? (
          <ConnectedWalletView
            address={connectionState.address!}
            walletType={connectionState.walletType!}
            network={connectionState.network!}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <div className="space-y-3">
            {/* Status announcement for screen readers */}
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {connectionState.status === 'connecting' &&
                `Connecting to ${connectionState.walletType} wallet`}
              {connectionState.status === 'error' && `Error: ${connectionState.error}`}
            </div>

            <WalletOption
              type="freighter"
              name="Freighter"
              description="Browser extension wallet for Stellar"
              icon="🚀"
              isConnecting={
                connectionState.status === 'connecting' && connectionState.walletType === 'freighter'
              }
              onSelect={() => handleWalletSelect('freighter')}
              disabled={connectionState.status === 'connecting'}
            />

            <WalletOption
              type="lobstr"
              name="Lobstr"
              description="Mobile and web wallet for Stellar"
              icon="🦞"
              isConnecting={
                connectionState.status === 'connecting' && connectionState.walletType === 'lobstr'
              }
              onSelect={() => handleWalletSelect('lobstr')}
              disabled={connectionState.status === 'connecting'}
            />

            <WalletOption
              type="walletconnect"
              name="WalletConnect"
              description="Connect with mobile wallets via QR code"
              icon="🔗"
              isConnecting={
                connectionState.status === 'connecting' &&
                connectionState.walletType === 'walletconnect'
              }
              onSelect={() => handleWalletSelect('walletconnect')}
              disabled={connectionState.status === 'connecting'}
            />

            {/* Error message */}
            {connectionState.status === 'error' && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {connectionState.error}
                    </p>
                    <button
                      onClick={handleRetry}
                      className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Wallet connection helper
async function connectToWallet(walletType: WalletType): Promise<string> {
  // Add timeout
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Connection timeout')), 30000)
  );

  const connection = (async () => {
    switch (walletType) {
      case 'freighter':
        return await connectFreighter();
      case 'lobstr':
        return await connectLobstr();
      case 'walletconnect':
        return await connectWalletConnect();
      default:
        throw new Error('Unsupported wallet type');
    }
  })();

  return Promise.race([connection, timeout]);
}

async function connectFreighter(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined');
  }

  const freighter = (window as Window & { freighter?: FreighterApi }).freighter;

  if (!freighter) {
    throw new Error('Freighter wallet not found. Please install the extension.');
  }

  try {
    const publicKey = await freighter.getPublicKey();
    if (!publicKey) {
      throw new Error('No public key returned');
    }
    return publicKey;
  } catch (error) {
    if (error instanceof Error && error.message.includes('rejected')) {
      throw new Error('Connection rejected by user');
    }
    throw error;
  }
}

interface FreighterApi {
  getPublicKey: () => Promise<string>;
}

async function connectLobstr(): Promise<string> {
  // Placeholder for Lobstr integration
  throw new Error('Lobstr wallet integration coming soon');
}

async function connectWalletConnect(): Promise<string> {
  // Placeholder for WalletConnect integration
  throw new Error('WalletConnect integration coming soon');
}

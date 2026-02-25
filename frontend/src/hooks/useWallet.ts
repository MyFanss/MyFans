'use client';

import { useState, useCallback, useEffect } from 'react';
import type { WalletType, WalletConnectionState } from '@/types/wallet';

interface UseWalletReturn {
  connectionState: WalletConnectionState;
  isConnected: boolean;
  address: string | null;
  walletType: WalletType | null;
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

/**
 * Hook for managing wallet connection state
 */
export function useWallet(): UseWalletReturn {
  const [connectionState, setConnectionState] = useState<WalletConnectionState>({
    status: 'disconnected',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const checkExistingConnection = useCallback(async () => {
    try {
      const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
      if (freighter) {
        const publicKey = await freighter.getPublicKey();
        if (publicKey) {
          setConnectionState({
            status: 'connected',
            address: publicKey,
            walletType: 'freighter',
            network: 'Stellar Mainnet',
          });
          return;
        }
      }
    } catch {
      // No existing connection
    }
    setConnectionState({ status: 'disconnected' });
  }, []);

  // Check for existing connection on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkExistingConnection();
  }, [checkExistingConnection]);

  // Listen for wallet disconnect events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAccountChange = () => {
      // Wallet account changed or disconnected
      void checkExistingConnection();
    };

    // Freighter specific event
    window.addEventListener('freighter:accountChanged', handleAccountChange);

    return () => {
      window.removeEventListener('freighter:accountChanged', handleAccountChange);
    };
  }, [checkExistingConnection]);

  const connect = useCallback(async (walletType: WalletType) => {
    setConnectionState({ status: 'connecting', walletType });

    try {
      const address = await connectToWallet(walletType);

      setConnectionState({
        status: 'connected',
        address,
        walletType,
        network: 'Stellar Mainnet',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setConnectionState({
        status: 'error',
        error: errorMessage,
        walletType,
      });
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectionState({ status: 'disconnected' });
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return {
    connectionState,
    isConnected: connectionState.status === 'connected',
    address: connectionState.status === 'connected' ? connectionState.address : null,
    walletType: connectionState.status === 'connected' ? connectionState.walletType : null,
    connect,
    disconnect,
    isModalOpen,
    openModal,
    closeModal,
  };
}

// Wallet connection helper
async function connectToWallet(walletType: WalletType): Promise<string> {
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

async function connectLobstr(): Promise<string> {
  throw new Error('Lobstr wallet integration coming soon');
}

async function connectWalletConnect(): Promise<string> {
  throw new Error('WalletConnect integration coming soon');
}

interface FreighterApi {
  getPublicKey: () => Promise<string>;
}

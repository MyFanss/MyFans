"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { WalletType, WalletConnectionState } from "@/types/wallet";
import {
  connectWallet,
  getConnectedAddress,
  getAnyConnectedAddress,
  isWalletConnected,
  isAnyWalletConnected,
  getWalletInstallUrl,
  isWalletInstalled,
} from "@/lib/wallet";

interface UseWalletOptions {
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface UseWalletReturn {
  connectionState: WalletConnectionState;
  isConnected: boolean;
  address: string | null;
  walletType: WalletType | null;
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  isWalletInstalled: (walletType: WalletType) => boolean;
  getInstallUrl: (walletType: WalletType) => string | null;
  isReconnecting: boolean;
  hasCheckedConnection: boolean;
}

/**
 * Hook for managing wallet connection state with resilience features
 */
export function useWallet(options: UseWalletOptions = {}): UseWalletReturn {
  const {
    autoReconnect = true,
    reconnectAttempts = 3,
    reconnectDelay = 1000,
  } = options;

  const [connectionState, setConnectionState] = useState<WalletConnectionState>(
    {
      status: "disconnected",
    },
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hasCheckedConnection, setHasCheckedConnection] = useState(false);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const checkExistingConnection = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // Check if any wallet is already connected
      const connected = await getAnyConnectedAddress();

      if (connected) {
        setConnectionState({
          status: "connected",
          address: connected.address,
          walletType: connected.walletType,
          network: "Stellar Mainnet",
        });
        return;
      }
    } catch {
      // No existing connection or error checking
    } finally {
      if (mountedRef.current) {
        setHasCheckedConnection(true);
      }
    }

    if (mountedRef.current) {
      setConnectionState({ status: "disconnected" });
    }
  }, []);

  // Check for existing connection on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkExistingConnection();
  }, [checkExistingConnection]);

  // Auto-reconnect logic
  const attemptReconnect = useCallback(async () => {
    if (!autoReconnect || reconnectAttemptsRef.current >= reconnectAttempts) {
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    reconnectAttemptsRef.current++;

    try {
      await checkExistingConnection();

      // If still disconnected, schedule another attempt
      if (
        connectionState.status === "disconnected" &&
        reconnectAttemptsRef.current < reconnectAttempts
      ) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            attemptReconnect();
          }
        }, reconnectDelay * reconnectAttemptsRef.current); // Exponential backoff
      } else {
        setIsReconnecting(false);
      }
    } catch {
      // Schedule retry on error
      if (reconnectAttemptsRef.current < reconnectAttempts) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            attemptReconnect();
          }
        }, reconnectDelay * reconnectAttemptsRef.current);
      } else {
        setIsReconnecting(false);
      }
    }
  }, [
    autoReconnect,
    reconnectAttempts,
    reconnectDelay,
    connectionState.status,
    checkExistingConnection,
  ]);

  // Listen for wallet disconnect events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAccountChange = () => {
      // Wallet account changed or disconnected
      void checkExistingConnection();

      // Trigger auto-reconnect if enabled
      if (autoReconnect) {
        reconnectAttemptsRef.current = 0;
        void attemptReconnect();
      }
    };

    const handleNetworkChange = () => {
      // Network changed - might need to reconnect
      void checkExistingConnection();
    };

    // Wallet-specific events
    window.addEventListener("freighter:accountChanged", handleAccountChange);
    window.addEventListener("freighter:networkChanged", handleNetworkChange);

    // Generic wallet events
    window.addEventListener("wallet:connected", handleAccountChange);
    window.addEventListener("wallet:disconnected", handleAccountChange);
    window.addEventListener("wallet:accountChanged", handleAccountChange);

    return () => {
      window.removeEventListener(
        "freighter:accountChanged",
        handleAccountChange,
      );
      window.removeEventListener(
        "freighter:networkChanged",
        handleNetworkChange,
      );
      window.removeEventListener("wallet:connected", handleAccountChange);
      window.removeEventListener("wallet:disconnected", handleAccountChange);
      window.removeEventListener("wallet:accountChanged", handleAccountChange);
    };
  }, [checkExistingConnection, autoReconnect, attemptReconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const connect = useCallback(async (walletType: WalletType) => {
    setConnectionState({ status: "connecting", walletType });
    reconnectAttemptsRef.current = 0; // Reset reconnect attempts on manual connect

    try {
      const address = await connectWallet(walletType);

      setConnectionState({
        status: "connected",
        address,
        walletType,
        network: "Stellar Mainnet",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to connect";
      setConnectionState({
        status: "error",
        error: errorMessage,
        walletType,
      });
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectionState({ status: "disconnected" });
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(false);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const reconnect = useCallback(async () => {
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(true);
    await attemptReconnect();
  }, [attemptReconnect]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const checkWalletInstalled = useCallback(
    (walletType: WalletType): boolean => {
      return isWalletInstalled(walletType);
    },
    [],
  );

  const getInstallUrlForWallet = useCallback(
    (walletType: WalletType): string | null => {
      return getWalletInstallUrl(walletType);
    },
    [],
  );

  return {
    connectionState,
    isConnected: connectionState.status === "connected",
    address:
      connectionState.status === "connected" ? connectionState.address : null,
    walletType:
      connectionState.status === "connected"
        ? connectionState.walletType
        : null,
    connect,
    disconnect,
    reconnect,
    isModalOpen,
    openModal,
    closeModal,
    isWalletInstalled: checkWalletInstalled,
    getInstallUrl: getInstallUrlForWallet,
    isReconnecting,
    hasCheckedConnection,
  };
}

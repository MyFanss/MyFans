import { createAppError, type AppError } from '@/types/errors';

/** Freighter wallet interface */
interface FreighterWallet {
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
}

/** Window with Freighter extension */
interface WindowWithFreighter extends Window {
  freighter?: FreighterWallet;
}

/** Wallet connection result */
export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  error?: AppError;
}

/**
 * Check if Freighter wallet is installed
 */
export function isWalletInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as WindowWithFreighter).freighter;
}

/**
 * Connect to Freighter wallet
 *
 * @returns Wallet address if successful, null otherwise
 * @throws AppError if connection fails
 */
export async function connectWallet(): Promise<string | null> {
  if (typeof window === 'undefined') {
    throw createAppError('WALLET_NOT_FOUND', {
      message: 'Window is not defined',
    });
  }

  const freighter = (window as WindowWithFreighter).freighter;

  if (!freighter) {
    throw createAppError('WALLET_NOT_FOUND', {
      message: 'Freighter wallet not found',
      description: 'Please install Freighter wallet extension to connect your wallet.',
      actions: [
        { label: 'Install Freighter', type: 'navigate', href: 'https://freighter.app', primary: true },
      ],
    });
  }

  try {
    const publicKey = await freighter.getPublicKey();

    if (!publicKey) {
      throw createAppError('WALLET_CONNECTION_FAILED', {
        message: 'No public key returned',
        description: 'Please unlock your wallet and try again.',
      });
    }

    return publicKey;
  } catch (err) {
    // Check if user rejected
    if (err instanceof Error && err.message.includes('rejected')) {
      throw createAppError('WALLET_CONNECTION_FAILED', {
        message: 'Connection rejected',
        description: 'You rejected the connection request. Please try again and approve the connection.',
        severity: 'warning',
      });
    }

    throw createAppError('WALLET_CONNECTION_FAILED', {
      message: err instanceof Error ? err.message : 'Unknown error',
      description: 'Failed to connect to wallet. Please try again.',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * Sign a transaction using Freighter
 *
 * @param xdr - Transaction XDR string
 * @returns Signed transaction XDR
 * @throws AppError if signing fails
 */
export async function signTransaction(xdr: string): Promise<string> {
  if (typeof window === 'undefined') {
    throw createAppError('WALLET_NOT_FOUND', {
      message: 'Window is not defined',
    });
  }

  const freighter = (window as WindowWithFreighter).freighter;

  if (!freighter) {
    throw createAppError('WALLET_NOT_FOUND', {
      message: 'Freighter wallet not found',
      description: 'Please install Freighter wallet extension to sign transactions.',
      actions: [
        { label: 'Install Freighter', type: 'navigate', href: 'https://freighter.app', primary: true },
      ],
    });
  }

  try {
    const signedXdr = await freighter.signTransaction(xdr);

    if (!signedXdr) {
      throw createAppError('WALLET_SIGNATURE_FAILED', {
        message: 'No signed transaction returned',
      });
    }

    return signedXdr;
  } catch (err) {
    // Check if user rejected
    if (err instanceof Error && (err.message.includes('rejected') || err.message.includes('denied'))) {
      throw createAppError('TX_REJECTED', {
        message: 'Transaction rejected',
        description: 'You rejected the transaction. Please try again and approve it in your wallet.',
        severity: 'warning',
      });
    }

    throw createAppError('WALLET_SIGNATURE_FAILED', {
      message: err instanceof Error ? err.message : 'Unknown error',
      description: 'Failed to sign transaction. Please try again.',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * Get the connected wallet address
 *
 * @returns Wallet address if connected, null otherwise
 */
export async function getConnectedAddress(): Promise<string | null> {
  if (!isWalletInstalled()) {
    return null;
  }

  try {
    const freighter = (window as WindowWithFreighter).freighter;
    return await freighter?.getPublicKey() ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if wallet is connected
 */
export async function isWalletConnected(): Promise<boolean> {
  const address = await getConnectedAddress();
  return address !== null;
}

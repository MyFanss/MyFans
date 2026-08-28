import { createAppError, type AppError } from '@/types/errors';
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags';
import { getWalletSession } from '@/lib/client-session';
import type { WalletType } from '@/types/wallet';
import {
  connectWalletConnect as connectWalletConnectClient,
  disconnectWalletConnect,
  getWalletConnectAddress,
  isWalletConnectConfigured,
  signWithWalletConnectClient,
} from '@/lib/walletconnect';

/** Clear copy when WalletConnect is stubbed / not yet available */
export const WALLETCONNECT_UNSUPPORTED_MESSAGE = 'WalletConnect is not available yet';
export const WALLETCONNECT_UNSUPPORTED_DESCRIPTION =
  'WalletConnect support is coming soon. Please connect with Freighter or Lobstr for now.';

/**
 * Whether WalletConnect is enabled via feature flag.
 * Defaults to false — the provider is a stub until fully integrated.
 */
export function isWalletConnectEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.WALLET_CONNECT);
}

/** Base wallet interface */
interface BaseWallet {
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
  isInstalled?: () => boolean;
  getInstallUrl?: () => string;
}

/** Freighter wallet interface */
interface FreighterWallet extends BaseWallet {
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
}

/** Lobstr wallet interface */
interface LobstrWallet extends BaseWallet {
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
}

/** WalletConnect interface */
interface WalletConnectWallet extends BaseWallet {
  getPublicKey: () => Promise<string>;
  signTransaction: (
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string },
  ) => Promise<string>;
}

/** Window with wallet extensions */
interface WindowWithWallets extends Window {
  freighter?: FreighterWallet;
  lobstr?: LobstrWallet;
  // WalletConnect typically uses a provider, not a direct window object
}

/** Wallet connection result */
export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  error?: AppError;
}

/**
 * Check if a specific wallet is installed
 */
export function isWalletInstalled(walletType: 'freighter' | 'lobstr' | 'walletconnect'): boolean {
  if (typeof window === 'undefined') return false;
  
  const windowWithWallets = window as WindowWithWallets;
  
  switch (walletType) {
    case 'freighter':
      return !!windowWithWallets.freighter;
    case 'lobstr':
      return !!windowWithWallets.lobstr;
    case 'walletconnect':
      // Protocol wallets need no extension; still gated by feature flag.
      return isWalletConnectEnabled();
    default:
      return false;
  }
}

/**
 * Get wallet installation URL if not installed
 */
export function getWalletInstallUrl(walletType: 'freighter' | 'lobstr' | 'walletconnect'): string | null {
  switch (walletType) {
    case 'freighter':
      return 'https://freighter.app';
    case 'lobstr':
      return 'https://lobstr.co';
    case 'walletconnect':
      return null; // WalletConnect doesn't require installation
    default:
      return null;
  }
}

/**
 * Connect to a specific wallet
 *
 * @param walletType - Type of wallet to connect to
 * @returns Wallet address if successful, null otherwise
 * @throws AppError if connection fails
 */
export async function connectWallet(walletType: 'freighter' | 'lobstr' | 'walletconnect'): Promise<string> {
  if (typeof window === 'undefined') {
    throw createAppError('WALLET_NOT_FOUND', {
      message: 'Window is not defined',
    });
  }

  // Check if wallet is installed
  if (!isWalletInstalled(walletType)) {
    const installUrl = getWalletInstallUrl(walletType);
    throw createAppError('WALLET_NOT_INSTALLED', {
      message: `${walletType} wallet not found`,
      description: `Please install ${walletType} wallet to connect.`,
      actions: installUrl ? [
        { label: `Install ${walletType}`, type: 'navigate', href: installUrl, primary: true },
      ] : [],
    });
  }

  try {
    switch (walletType) {
      case 'freighter':
        return await connectFreighter();
      case 'lobstr':
        return await connectLobstr();
      case 'walletconnect':
        return await connectWalletConnect();
      default:
        throw createAppError('UNSUPPORTED_WALLET', {
          message: `Unsupported wallet type: ${walletType}`,
        });
    }
  } catch (err) {
    // Re-throw AppError as-is
    if (err && typeof err === 'object' && 'code' in err) {
      throw err;
    }

    // Handle user rejection
    if (err instanceof Error && (err.message.includes('rejected') || err.message.includes('denied'))) {
      throw createAppError('WALLET_CONNECTION_REJECTED', {
        message: 'Connection rejected',
        description: 'You rejected the connection request. Please try again and approve the connection.',
        severity: 'warning',
      });
    }

    throw createAppError('WALLET_CONNECTION_FAILED', {
      message: err instanceof Error ? err.message : 'Unknown error',
      description: `Failed to connect to ${walletType} wallet. Please try again.`,
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * @deprecated Use connectWallet(walletType) instead
 */
export async function connectWalletLegacy(): Promise<string | null> {
  try {
    return await connectWallet('freighter');
  } catch {
    return null;
  }
}

/** Options accepted by {@link signTransaction}. */
export interface SignTransactionOptions {
  /**
   * Which wallet to sign with. When omitted, the wallet recorded in the
   * session store at connect time is used, falling back to Freighter for
   * legacy callers that never persisted a wallet type.
   */
  walletType?: WalletType;
  /** Network name (e.g. `testnet`) — forwarded to wallets that need it. */
  network?: string;
  /** Network passphrase — required by WalletConnect, ignored by extensions. */
  networkPassphrase?: string;
}

/**
 * Resolve which wallet should sign: an explicit choice wins, otherwise the
 * wallet the fan connected with (from the session store), otherwise Freighter.
 */
export function resolveSigningWalletType(explicit?: WalletType): WalletType {
  if (explicit) return explicit;
  return getWalletSession()?.walletType ?? 'freighter';
}

/**
 * Sign a transaction using the connected wallet.
 *
 * Dispatches to the Freighter, Lobstr, or WalletConnect signer based on
 * {@link SignTransactionOptions.walletType} (or the connected wallet in the
 * session store). A bare wallet-type string is also accepted for convenience.
 *
 * @param xdr - Transaction XDR string
 * @param options - Signing options, or a wallet-type string
 * @returns Signed transaction XDR
 * @throws AppError if signing fails or the wallet type is unknown
 */
export async function signTransaction(
  xdr: string,
  options: SignTransactionOptions | WalletType = {},
): Promise<string> {
  if (typeof window === 'undefined') {
    throw createAppError('WALLET_NOT_FOUND', {
      message: 'Window is not defined',
    });
  }

  const opts: SignTransactionOptions =
    typeof options === 'string' ? { walletType: options } : options;
  const walletType = resolveSigningWalletType(opts.walletType);
  const signOpts = { network: opts.network, networkPassphrase: opts.networkPassphrase };

  try {
    let signedXdr: string;

    switch (walletType) {
      case 'freighter':
        signedXdr = await signWithFreighter(xdr);
        break;
      case 'lobstr':
        signedXdr = await signWithLobstr(xdr);
        break;
      case 'walletconnect':
        signedXdr = await signWithWalletConnect(xdr, signOpts);
        break;
      default:
        throw createAppError('UNSUPPORTED_WALLET', {
          message: `Cannot sign: unknown wallet type "${String(walletType)}"`,
          description:
            'Reconnect your wallet and try again. If this keeps happening, disconnect and pick a wallet from the list.',
        });
    }

    if (!signedXdr) {
      throw createAppError('WALLET_SIGNATURE_FAILED', {
        message: 'No signed transaction returned',
      });
    }

    return signedXdr;
  } catch (err) {
    // Re-throw AppError as-is
    if (err && typeof err === 'object' && 'code' in err) {
      throw err;
    }

    // Handle user rejection
    if (err instanceof Error && (err.message.includes('rejected') || err.message.includes('denied'))) {
      throw createAppError('TX_REJECTED', {
        message: 'Transaction rejected',
        description: 'You rejected the transaction. Please try again and approve it in your wallet.',
        severity: 'warning',
      });
    }

    throw createAppError('WALLET_SIGNATURE_FAILED', {
      message: err instanceof Error ? err.message : 'Unknown error',
      description: `Failed to sign transaction. Please try again.`,
      cause: err instanceof Error ? err : undefined,
    });
  }
}

/**
 * @deprecated Use signTransaction(xdr, walletType) instead
 */
export async function signTransactionLegacy(xdr: string): Promise<string> {
  return signTransaction(xdr);
}

/**
 * Get the connected wallet address for a specific wallet
 *
 * @param walletType - Type of wallet to check
 * @returns Wallet address if connected, null otherwise
 */
export async function getConnectedAddress(walletType: 'freighter' | 'lobstr' | 'walletconnect'): Promise<string | null> {
  if (!isWalletInstalled(walletType)) {
    return null;
  }

  try {
    const windowWithWallets = window as WindowWithWallets;
    
    switch (walletType) {
      case 'freighter':
        return await windowWithWallets.freighter?.getPublicKey() ?? null;
      case 'lobstr':
        return await windowWithWallets.lobstr?.getPublicKey() ?? null;
      case 'walletconnect':
        return isWalletConnectEnabled() ? await getWalletConnectAddress() : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Disconnect a wallet. Only WalletConnect holds a session that must be torn
 * down explicitly; Freighter/Lobstr are stateless from our side, so this is a
 * no-op for them (callers still clear their own UI/session state).
 */
export async function disconnectWallet(walletType?: WalletType): Promise<void> {
  const type = walletType ?? getWalletSession()?.walletType;
  if (type === 'walletconnect') {
    await disconnectWalletConnect();
  }
}

/**
 * Get the connected wallet address (checks all wallets)
 *
 * @returns First available wallet address if connected, null otherwise
 */
export async function getAnyConnectedAddress(): Promise<{ address: string; walletType: 'freighter' | 'lobstr' | 'walletconnect' } | null> {
  const walletTypes: Array<'freighter' | 'lobstr' | 'walletconnect'> = ['freighter', 'lobstr', 'walletconnect'];
  
  for (const walletType of walletTypes) {
    const address = await getConnectedAddress(walletType);
    if (address) {
      return { address, walletType };
    }
  }
  
  return null;
}

/**
 * @deprecated Use getConnectedAddress(walletType) instead
 */
export async function getConnectedAddressLegacy(): Promise<string | null> {
  return getConnectedAddress('freighter');
}

/**
 * Check if a specific wallet is connected
 */
export async function isWalletConnected(walletType: 'freighter' | 'lobstr' | 'walletconnect'): Promise<boolean> {
  const address = await getConnectedAddress(walletType);
  return address !== null;
}

/**
 * Check if any wallet is connected
 */
export async function isAnyWalletConnected(): Promise<boolean> {
  const connected = await getAnyConnectedAddress();
  return connected !== null;
}

/**
 * @deprecated Use isWalletConnected(walletType) instead
 */
export async function isWalletConnectedLegacy(): Promise<boolean> {
  return isWalletConnected('freighter');
}

// Wallet-specific implementation functions

async function connectFreighter(): Promise<string> {
  const freighter = (window as WindowWithWallets).freighter;
  if (!freighter) {
    throw new Error('Freighter wallet not found');
  }
  
  const publicKey = await freighter.getPublicKey();
  if (!publicKey) {
    throw new Error('No public key returned from Freighter');
  }
  
  return publicKey;
}

async function connectLobstr(): Promise<string> {
  const lobstr = (window as WindowWithWallets).lobstr;
  if (!lobstr) {
    throw new Error('Lobstr wallet not found');
  }
  
  const publicKey = await lobstr.getPublicKey();
  if (!publicKey) {
    throw new Error('No public key returned from Lobstr');
  }
  
  return publicKey;
}

async function connectWalletConnect(): Promise<string> {
  if (!isWalletConnectEnabled()) {
    // Flag off: keep the clear "coming soon" CTA without crashing other flows.
    throw createAppError('UNSUPPORTED_WALLET', {
      message: WALLETCONNECT_UNSUPPORTED_MESSAGE,
      description: WALLETCONNECT_UNSUPPORTED_DESCRIPTION,
      actions: [
        { label: 'Use Freighter', type: 'retry', primary: true },
      ],
    });
  }

  if (!isWalletConnectConfigured()) {
    throw createAppError('WALLET_CONNECT_CONFIG_MISSING', {
      message: 'WalletConnect project ID is not configured',
    });
  }

  return connectWalletConnectClient();
}

async function signWithFreighter(xdr: string): Promise<string> {
  const freighter = (window as WindowWithWallets).freighter;
  if (!freighter) {
    throw new Error('Freighter wallet not found');
  }
  
  const signedXdr = await freighter.signTransaction(xdr);
  if (!signedXdr) {
    throw new Error('No signed transaction returned from Freighter');
  }
  
  return signedXdr;
}

async function signWithLobstr(xdr: string): Promise<string> {
  const lobstr = (window as WindowWithWallets).lobstr;
  if (!lobstr) {
    throw new Error('Lobstr wallet not found');
  }
  
  const signedXdr = await lobstr.signTransaction(xdr);
  if (!signedXdr) {
    throw new Error('No signed transaction returned from Lobstr');
  }
  
  return signedXdr;
}

async function signWithWalletConnect(
  xdr: string,
  opts?: { network?: string; networkPassphrase?: string },
): Promise<string> {
  if (!isWalletConnectEnabled()) {
    throw createAppError('UNSUPPORTED_WALLET', {
      message: WALLETCONNECT_UNSUPPORTED_MESSAGE,
      description: WALLETCONNECT_UNSUPPORTED_DESCRIPTION,
    });
  }

  return signWithWalletConnectClient(xdr, opts);
}

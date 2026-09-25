/**
 * Freighter reference wallet path.
 *
 * Provides detect/connect, network passphrase guard, and a signTransaction
 * path for subscribe/cancel flows. Freighter is the only guaranteed wallet,
 * so this module is the canonical reference implementation.
 *
 * Security: we never request or handle secret keys. All signing happens
 * inside the Freighter extension; we only pass an unsigned XDR.
 */

import {
  isConnected,
  requestAccess,
  getNetwork,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';

export type WalletErrorCode =
  | 'FREIGHTER_MISSING'
  | 'POPUP_BLOCKED'
  | 'USER_REJECTED'
  | 'NETWORK_MISMATCH'
  | 'SIGN_FAILED';

export class WalletError extends Error {
  code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

/**
 * Map raw Freighter / wallet errors into user-readable WalletError instances.
 */
export function mapWalletError(err: unknown): WalletError {
  if (err instanceof WalletError) {
    return err;
  }

  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('not installed') || lower.includes('not available') || lower.includes('freighter')) {
    return new WalletError(
      'FREIGHTER_MISSING',
      'Freighter wallet was not detected. Install the Freighter extension and reload the page.',
    );
  }

  if (lower.includes('popup') || lower.includes('blocked')) {
    return new WalletError(
      'POPUP_BLOCKED',
      'The Freighter popup was blocked. Allow popups for this site and try again.',
    );
  }

  if (lower.includes('reject') || lower.includes('denied') || lower.includes('cancel')) {
    return new WalletError('USER_REJECTED', 'You rejected the request in Freighter.');
  }

  if (lower.includes('network') || lower.includes('passphrase')) {
    return new WalletError(
      'NETWORK_MISMATCH',
      'Freighter is on a different network than this app. Switch networks in Freighter and retry.',
    );
  }

  return new WalletError('SIGN_FAILED', raw || 'Freighter signing failed. Please try again.');
}

/**
 * Detect whether the Freighter extension is available in this browser.
 */
export async function detectFreighter(): Promise<boolean> {
  try {
    const result = await isConnected();
    return Boolean(result && (result as { isConnected?: boolean }).isConnected);
  } catch {
    return false;
  }
}

/**
 * Connect to Freighter via requestAccess, returning the active public key.
 * Throws a user-readable WalletError when Freighter is missing or the user
 * rejects the connection.
 */
export async function connectFreighter(): Promise<string> {
  const available = await detectFreighter();
  if (!available) {
    throw new WalletError(
      'FREIGHTER_MISSING',
      'Freighter wallet was not detected. Install the Freighter extension and reload the page.',
    );
  }

  try {
    const access = await requestAccess();
    const address = (access as { address?: string }).address;
    if (!address) {
      throw new WalletError('USER_REJECTED', 'You rejected the connection request in Freighter.');
    }
    return address;
  } catch (err) {
    throw mapWalletError(err);
  }
}

/**
 * Validate that Freighter's active network matches the app's configured
 * network passphrase. Must be called before building any transaction.
 */
export async function assertNetwork(expectedPassphrase: string): Promise<void> {
  let active: string | undefined;
  try {
    const network = await getNetwork();
    active = (network as { networkPassphrase?: string }).networkPassphrase;
  } catch (err) {
    throw mapWalletError(err);
  }

  if (!active || active !== expectedPassphrase) {
    throw new WalletError(
      'NETWORK_MISMATCH',
      'Freighter is on a different network than this app. Switch networks in Freighter and retry.',
    );
  }
}

/**
 * Sign an unsigned transaction XDR through Freighter.
 *
 * The caller is responsible for building the transaction for the correct
 * network; this function enforces the network guard before signing.
 */
export async function signTransaction(
  xdr: string,
  expectedPassphrase: string,
): Promise<string> {
  await assertNetwork(expectedPassphrase);

  try {
    const result = await freighterSignTransaction(xdr, {
      networkPassphrase: expectedPassphrase,
    });
    const signed = (result as { signedTxXdr?: string }).signedTxXdr;
    if (!signed) {
      throw new WalletError('SIGN_FAILED', 'Freighter did not return a signed transaction.');
    }
    return signed;
  } catch (err) {
    throw mapWalletError(err);
  }
}

/**
 * Sign a subscribe transaction XDR.
 */
export function signSubscribeTransaction(
  xdr: string,
  expectedPassphrase: string,
): Promise<string> {
  return signTransaction(xdr, expectedPassphrase);
}

/**
 * Sign a cancel transaction XDR.
 */
export function signCancelTransaction(
  xdr: string,
  expectedPassphrase: string,
): Promise<string> {
  return signTransaction(xdr, expectedPassphrase);
}

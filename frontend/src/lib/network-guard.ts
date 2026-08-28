/**
 * Network mismatch guard for mutating Stellar operations.
 *
 * `useNetworkGuard` (a React hook) surfaces a mismatch in the UI, but the
 * low-level builders/submitters in `@/lib/stellar` run outside React and
 * must refuse to sign or broadcast when the connected wallet is on a
 * different Stellar network than the app is configured for — otherwise a
 * testnet deployment could push a transaction to mainnet (or vice-versa)
 * if the wallet supplies the network passphrase.
 *
 * Read-only simulations are intentionally NOT gated: this only throws for
 * the sign/submit path.
 */
import { getRuntimeContractConfig } from '@/lib/contract-config';
import { createAppError } from '@/types/errors';

/** Maps our config network names to the strings wallets report. */
export const WALLET_NETWORK_NAME_MAP: Record<string, string> = {
  testnet: 'TESTNET',
  futurenet: 'FUTURENET',
  mainnet: 'PUBLIC',
};

interface WalletNetworkResponse {
  network: string;
  networkPassphrase: string;
}

interface WindowWithWallets extends Window {
  freighter?: { getNetwork?: () => Promise<WalletNetworkResponse> };
  lobstr?: { getNetwork?: () => Promise<WalletNetworkResponse> };
}

/** Normalise an app network name (e.g. `testnet`) to the wallet form (`TESTNET`). */
export function normalizeExpectedNetwork(expected: string): string {
  return (WALLET_NETWORK_NAME_MAP[expected] ?? expected).toUpperCase();
}

/**
 * Pure comparison: `true` when a wallet-reported network is present and
 * differs from the expected network. Unknown/absent wallet network → `false`.
 */
export function isNetworkMismatch(
  detected: string | null | undefined,
  expected: string,
): boolean {
  if (!detected) return false;
  return detected.toUpperCase() !== normalizeExpectedNetwork(expected);
}

/**
 * Reads the current network from an injected wallet (Freighter, then
 * Lobstr). Returns `null` when there is no wallet or the call fails.
 */
export async function detectWalletNetwork(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const w = window as WindowWithWallets;
  try {
    if (w.freighter?.getNetwork) {
      return (await w.freighter.getNetwork())?.network ?? null;
    }
    if (w.lobstr?.getNetwork) {
      return (await w.lobstr.getNetwork())?.network ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Throws a `NETWORK_MISMATCH` AppError when the connected wallet reports a
 * different Stellar network than the app's runtime config. No-ops when no
 * wallet is present or the wallet network can't be read.
 */
export async function assertWalletNetworkMatches(): Promise<void> {
  const expected = getRuntimeContractConfig().network;
  const detected = await detectWalletNetwork();

  if (isNetworkMismatch(detected, expected)) {
    throw createAppError('NETWORK_MISMATCH', {
      message: 'Your wallet is on the wrong network',
      description:
        `This app runs on ${normalizeExpectedNetwork(expected)} but your wallet is on ` +
        `${detected}. Switch networks in your wallet and try again.`,
    });
  }
}

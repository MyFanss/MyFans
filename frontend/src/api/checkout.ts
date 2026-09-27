import { apiFetch } from './client';

export type CheckoutStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface CheckoutHistoryEntry {
  id: string;
  createdAt: string;
  updatedAt?: string;
  status: CheckoutStatus;
  amount: string;
  currency: string;
  description?: string;
  /** Signed transaction hash. Absent/null while the transaction is still pending. */
  txHash?: string | null;
  /** Network the transaction was submitted to (e.g. 'mainnet', 'testnet', 'futurenet'). */
  network?: string | null;
}

export interface CheckoutHistoryResponse {
  entries: CheckoutHistoryEntry[];
}

/**
 * Fetch checkout history for the current account.
 *
 * The API returns checkout records merged with their signed transaction
 * hashes. Entries that have not been signed yet omit `txHash` (or return
 * null) and must be rendered as pending rather than with a placeholder hash.
 */
export async function fetchCheckoutHistory(): Promise<CheckoutHistoryEntry[]> {
  const res = await apiFetch('/checkout/history');
  if (!res.ok) {
    throw new Error(`Failed to load checkout history (${res.status})`);
  }
  const data = (await res.json()) as CheckoutHistoryResponse | CheckoutHistoryEntry[];
  if (Array.isArray(data)) {
    return data;
  }
  return data.entries ?? [];
}

/**
 * Returns true only when a real, signed transaction hash is present.
 * Guards against placeholder/empty hashes being rendered as real ones.
 */
export function hasSignedTxHash(entry: CheckoutHistoryEntry): boolean {
  return typeof entry.txHash === 'string' && entry.txHash.trim().length > 0;
}

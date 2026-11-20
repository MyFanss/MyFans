export type StellarNetwork = 'public' | 'testnet' | 'futurenet';

/** Canonical network for a raw name (case-insensitive; mainnet is an alias of public). */
export function normalizeNetwork(raw: string | null | undefined): StellarNetwork | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'public' || value === 'mainnet') return 'public';
  if (value === 'testnet') return 'testnet';
  if (value === 'futurenet') return 'futurenet';
  return null;
}

export function getActiveNetwork(): StellarNetwork {
  return normalizeNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') ?? 'testnet';
}

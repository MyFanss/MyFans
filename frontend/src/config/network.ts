export type StellarNetwork = 'public' | 'testnet' | 'futurenet';

export function getActiveNetwork(): StellarNetwork {
  const raw = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet').trim().toLowerCase();
  if (raw === 'public' || raw === 'mainnet') return 'public';
  if (raw === 'futurenet') return 'futurenet';
  return 'testnet';
}

/** Returns undefined when unset so callers fail closed instead of signing with a guessed passphrase. */
export function getNetworkPassphrase(): string | undefined {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE?.trim() || undefined;
}

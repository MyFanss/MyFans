export type StellarNetwork = 'public' | 'testnet' | 'futurenet';

export function getActiveNetwork(): StellarNetwork {
  const raw = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet').trim().toLowerCase();
  if (raw === 'public' || raw === 'mainnet') return 'public';
  if (raw === 'futurenet') return 'futurenet';
  return 'testnet';
}

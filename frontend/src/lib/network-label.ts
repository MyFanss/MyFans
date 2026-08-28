/**
 * Human-readable Stellar network labels.
 *
 * The label must always reflect the network the app is actually configured
 * against (driven by runtime config / the backend `/config/network` endpoint).
 * A hardcoded "Mainnet"/"Public" chip on a testnet build trains users to
 * ignore network-mismatch warnings and send the wrong asset (PLATFORM_TRIAGE
 * PR-008), so the only place "Public" may appear is a genuine public-network
 * build.
 */

/** Canonical network identifiers used across the app / contract config. */
export type StellarNetworkId = 'testnet' | 'futurenet' | 'mainnet' | 'public' | string;

/**
 * Turn a raw network id (`testnet`, `futurenet`, `mainnet`, `public`, …) into a
 * display label. `mainnet`/`public` both render as "Stellar Public"; anything
 * else is title-cased. Unknown/empty values fall back to a neutral "Stellar".
 */
export function stellarNetworkLabel(network: string | null | undefined): string {
  const normalized = (network ?? '').trim().toLowerCase();

  if (!normalized) {
    return 'Stellar';
  }

  if (normalized === 'mainnet' || normalized === 'public') {
    return 'Stellar Public';
  }

  return `Stellar ${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

/**
 * Whether a network id or label refers to the public (production) Stellar
 * network. Used to gate the only UI that is allowed to say "Public".
 */
export function isPublicStellarNetwork(networkOrLabel: string | null | undefined): boolean {
  const normalized = (networkOrLabel ?? '').trim().toLowerCase();
  return (
    normalized === 'mainnet' ||
    normalized === 'public' ||
    normalized === 'stellar public'
  );
}

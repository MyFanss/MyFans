/**
 * Network-aware Stellar block explorer URLs (#1609).
 *
 * Transaction hashes surfaced in the UI (the transactions page, the checkout
 * receipt, the tracked-transaction history) must link to the *same* Stellar
 * network the app is actually configured for. Hardcoding
 * `stellar.expert/explorer/testnet/...` (or `/public/...`) means a mainnet
 * deployment links every hash to a testnet explorer that 404s, and vice
 * versa.
 *
 * The network is resolved from the runtime contract config
 * (`NEXT_PUBLIC_STELLAR_NETWORK`, see `contract-config.ts`) so a single env
 * var keeps the RPC/Horizon hosts, the CSP allowlist and these explorer
 * links in sync.
 */
import {
  getRuntimeContractConfig,
  type StellarNetwork,
} from '@/lib/contract-config';

/** stellar.expert path segment for each Stellar network. */
const STELLAR_EXPERT_NETWORK_SEGMENT: Record<StellarNetwork, string> = {
  mainnet: 'public',
  testnet: 'testnet',
  futurenet: 'futurenet',
};

const STELLAR_EXPERT_ORIGIN = 'https://stellar.expert';

/** A confirmed Stellar transaction hash is 64 lowercase hex characters. */
const TX_HASH_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Returns `true` only for a real, on-chain-shaped transaction hash. Guards
 * against linking placeholder strings (`"pending"`, `"hash"`, `""`, a
 * checkout id, ...) to an explorer, which is the "no placeholder hashes"
 * acceptance criterion for the transactions page.
 */
export function isValidStellarTxHash(value: string | null | undefined): value is string {
  return typeof value === 'string' && TX_HASH_PATTERN.test(value.trim());
}

/** Resolve the active Stellar network, falling back to `testnet`. */
function resolveNetwork(network?: StellarNetwork): StellarNetwork {
  if (network) return network;
  try {
    return getRuntimeContractConfig().network;
  } catch {
    return 'testnet';
  }
}

/** Base explorer URL for the given (or configured) network, no trailing slash. */
export function getStellarExpertBaseUrl(network?: StellarNetwork): string {
  const segment = STELLAR_EXPERT_NETWORK_SEGMENT[resolveNetwork(network)];
  return `${STELLAR_EXPERT_ORIGIN}/explorer/${segment}`;
}

/**
 * Explorer URL for a transaction hash on the active (or explicitly passed)
 * network. Returns `null` when the hash is missing or not hash-shaped so
 * callers render a plain "–" instead of a broken link.
 */
export function getStellarExpertTxUrl(
  txHash: string | null | undefined,
  network?: StellarNetwork,
): string | null {
  if (!isValidStellarTxHash(txHash)) return null;
  return `${getStellarExpertBaseUrl(network)}/tx/${txHash.trim()}`;
}

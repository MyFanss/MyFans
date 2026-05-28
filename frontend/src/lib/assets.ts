/**
 * Supported Stellar asset registry for multi-asset price display.
 *
 * Each entry maps a Soroban token contract address to a human-readable symbol
 * and decimal precision. XLM is represented by the native asset sentinel.
 *
 * Add new assets here; the rest of the UI reads from this registry.
 */

export interface StellarAsset {
  /** Soroban contract address, or "native" for XLM. */
  contractId: string;
  /** Ticker shown in the UI (e.g. "XLM", "USDC"). */
  symbol: string;
  /** Token decimal places used for atomic ↔ display conversion. */
  decimals: number;
  /** Whether this is a stablecoin (affects display hints). */
  isStablecoin: boolean;
}

/** Sentinel used for Stellar's native XLM asset. */
export const XLM_NATIVE_SENTINEL = 'native';

export const SUPPORTED_ASSETS: StellarAsset[] = [
  {
    contractId: process.env.NEXT_PUBLIC_XLM_CONTRACT_ID ?? XLM_NATIVE_SENTINEL,
    symbol: 'XLM',
    decimals: 7,
    isStablecoin: false,
  },
  {
    contractId: process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ?? '',
    symbol: 'USDC',
    decimals: 7,
    isStablecoin: true,
  },
];

/**
 * Look up an asset by its contract address.
 * Returns `undefined` when the address is not in the registry.
 */
export function getAssetByContractId(contractId: string): StellarAsset | undefined {
  const normalized = contractId.trim();
  return SUPPORTED_ASSETS.find((a) => a.contractId === normalized);
}

/**
 * Return the symbol for a contract address, falling back to a truncated
 * address when the asset is not in the registry.
 */
export function getAssetSymbol(contractId: string): string {
  const asset = getAssetByContractId(contractId);
  if (asset) return asset.symbol;
  const t = contractId.trim();
  if (!t) return 'TOKEN';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/**
 * Return the decimal precision for a contract address.
 * Falls back to 7 (Stellar default) for unknown assets.
 */
export function getAssetDecimals(contractId: string): number {
  return getAssetByContractId(contractId)?.decimals ?? 7;
}

/**
 * Format an atomic token amount (i128 string) into a human-readable display
 * string with the asset symbol.
 *
 * @example
 * formatAtomicAssetAmount('10000000', 'native')  // "1.0000000 XLM"
 * formatAtomicAssetAmount('5000000',  usdcAddr)  // "0.5000000 USDC"
 */
export function formatAtomicAssetAmount(atomicAmount: string, contractId: string): string {
  const asset = getAssetByContractId(contractId);
  const decimals = asset?.decimals ?? 7;
  const symbol = asset?.symbol ?? getAssetSymbol(contractId);

  const raw = BigInt(atomicAmount);
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0');

  return `${whole}.${fracStr} ${symbol}`;
}

/**
 * Format a display-unit price (e.g. "12.50") with the asset symbol.
 *
 * @example
 * formatDisplayAssetPrice('12.50', 'native')  // "12.50 XLM"
 * formatDisplayAssetPrice('5.00',  usdcAddr)  // "5.00 USDC"
 */
export function formatDisplayAssetPrice(displayPrice: string, contractId: string): string {
  const symbol = getAssetSymbol(contractId);
  return `${displayPrice} ${symbol}`;
}

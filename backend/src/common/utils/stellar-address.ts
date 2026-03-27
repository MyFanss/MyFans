/**
 * Minimal Stellar **account** address check (G-strkey, 56 chars).
 * Does not validate checksum; good enough for API guardrails.
 */
export function isStellarAccountAddress(value: string): boolean {
  return typeof value === 'string' && value.startsWith('G') && value.length === 56;
}

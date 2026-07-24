import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Strict Stellar account address (G-strkey).
 * Allowlist: exactly 'G' followed by 55 uppercase base-32 chars [A-Z2-7].
 * Rejects null bytes, control chars, SQL/NoSQL metacharacters, oversized input.
 */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function isStellarAccountAddress(value: unknown): boolean {
  return typeof value === 'string' && STELLAR_ADDRESS_RE.test(value);
}

/**
 * Strips every character outside the valid G-strkey alphabet.
 * Returns null when the result is not a valid address so callers
 * reject rather than silently accept a mutated value.
 */
export function sanitizeStellarAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^A-Z2-7]/g, '');
  return STELLAR_ADDRESS_RE.test(cleaned) ? cleaned : null;
}

/** class-validator decorator for any DTO field holding a wallet address. */
export function IsStellarAddress(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStellarAddress',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a valid Stellar account address (G-strkey, 56 chars, base-32)`,
        ...options,
      },
      validator: { validate: isStellarAccountAddress },
    });
  };
}

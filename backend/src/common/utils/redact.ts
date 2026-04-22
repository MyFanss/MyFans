/**
 * Sensitive field names whose values must never appear in logs.
 * Keys are matched case-insensitively.
 */
export const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'authorization',
  'secret',
  'private_key',
  'privatekey',
  'seed',
  'mnemonic',
  'jwt',
  'api_key',
  'apikey',
  'email',
  'wallet_address',
  'walletaddress',
  'stellar_secret',
  'stellarsecret',
]);

/** Placeholder substituted for redacted values. */
export const REDACTED = '[REDACTED]';

/**
 * Recursively redact sensitive fields from an object or array.
 * Returns a new value; the original is not mutated.
 */
export function redact<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(redact) as unknown as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redact(v);
    }
    return result as T;
  }

  return value;
}

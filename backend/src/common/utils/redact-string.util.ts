/**
 * Redacts secret-shaped substrings out of free-text (error messages, stack
 * traces, thrown Error#message). Complements `redact()` in `redact.ts`,
 * which only strips known-sensitive *keys* out of objects — it can't catch
 * a JWT or webhook secret embedded inside a plain string, e.g.
 * `Invalid signature for token eyJhbGciOi...` or an exception message that
 * interpolated a webhook signing secret.
 */

const JWT_PATTERN = /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{10,}\b/gi;

// Matches "secret=..." / "secret: ..." / "webhookSecret=..." style key-value
// pairs embedded in a message string, up to the next whitespace/quote/comma.
const KEYED_SECRET_PATTERN =
  /\b((?:webhook|signing|client|api)?_?secret|_?token)\s*[:=]\s*['"]?([^\s'",;}]{6,})/gi;

export const STRING_REDACTED = '[REDACTED]';

/**
 * Redact JWT-shaped tokens, Authorization: Bearer values, and key=value /
 * key: value secret patterns out of a plain string.
 */
export function redactString(input: string): string {
  if (typeof input !== 'string' || input.length === 0) {
    return input;
  }

  return input
    .replace(JWT_PATTERN, STRING_REDACTED)
    .replace(BEARER_PATTERN, `Bearer ${STRING_REDACTED}`)
    .replace(KEYED_SECRET_PATTERN, (_match, key: string) => `${key}=${STRING_REDACTED}`);
}

/**
 * Redact an Error's message and stack (if present), returning plain strings
 * suitable for logging. Does not mutate the original Error.
 */
export function redactError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      message: redactString(err.message),
      stack: err.stack ? redactString(err.stack) : undefined,
    };
  }
  return { message: redactString(String(err)) };
}

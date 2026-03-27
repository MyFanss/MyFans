const SENSITIVE_KEY = /password|secret|token|authorization|cookie|apikey|api[_-]?key|bearer|refresh|access|credential|newsecret|new_secret/i;

function looksLikeJwt(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 10);
}

/**
 * Strips or redacts values that must never appear in audit metadata (secrets, raw tokens).
 */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (typeof v === 'string') {
      if (looksLikeJwt(v)) {
        out[k] = '[REDACTED_JWT]';
      } else {
        out[k] = v;
      }
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      const nested = sanitizeAuditMetadata(v as Record<string, unknown>);
      if (nested && Object.keys(nested).length > 0) {
        out[k] = nested;
      }
    } else {
      out[k] = v as unknown;
    }
  }
  return Object.keys(out).length ? out : null;
}

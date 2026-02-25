import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// ─── Domain Allowlist ────────────────────────────────────────────────────────

/**
 * Only URLs with these domains (or subdomains thereof) are accepted
 * for social link fields that use URL-based validation.
 */
export const ALLOWED_DOMAINS: readonly string[] = [
  'twitter.com',
  'instagram.com',
  'linkedin.com',
];

/**
 * Checks whether a given hostname matches one of the allowed domains,
 * including subdomains (e.g. www.twitter.com → twitter.com ✓).
 */
function hostnameMatchesAllowlist(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return ALLOWED_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`),
  );
}

/**
 * Standalone utility – usable in the service layer for an extra guard
 * before persisting. Returns `true` if the URL's domain is allowed,
 * `false` otherwise. Returns `true` for null/undefined/empty (optional).
 */
export function isAllowedDomain(url: string | null | undefined): boolean {
  if (url === null || url === undefined || url === '') return true;
  if (typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    return hostnameMatchesAllowlist(parsed.hostname);
  } catch {
    return false;
  }
}

// ─── Sanitized HTTPS URL validator ───────────────────────────────────────────

@ValidatorConstraint({ name: 'isSafeUrl', async: false })
export class IsSafeUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true; // optional field

    if (typeof value !== 'string') return false;

    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'URL must be a valid http or https URL';
  }
}

export function IsSafeUrl(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsSafeUrlConstraint,
    });
  };
}

// ─── Domain allowlist validator ──────────────────────────────────────────────

@ValidatorConstraint({ name: 'isAllowedDomain', async: false })
export class IsAllowedDomainConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true; // optional field

    if (typeof value !== 'string') return false;

    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
      return hostnameMatchesAllowlist(url.hostname);
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return `URL domain is not allowed. Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`;
  }
}

export function IsAllowedDomain(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsAllowedDomainConstraint,
    });
  };
}

// ─── Social handle validator (@username, no spaces) ──────────────────────────

@ValidatorConstraint({ name: 'isSocialHandle', async: false })
export class IsSocialHandleConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true;

    if (typeof value !== 'string') return false;

    // Strip leading @ if present, then validate
    const handle = value.startsWith('@') ? value.slice(1) : value;

    // Standard social handle: alphanumeric + underscore/dot, 1-50 chars
    return /^[a-zA-Z0-9_\.]{1,50}$/.test(handle);
  }

  defaultMessage(): string {
    return 'Handle must be alphanumeric (optionally prefixed with @), 1–50 characters';
  }
}

export function IsSocialHandle(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsSocialHandleConstraint,
    });
  };
}

// ─── URL sanitizer utility ───────────────────────────────────────────────────

/**
 * Strips javascript:, data:, and non http(s) schemes.
 * Returns null for invalid/empty input.
 */
export function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;

  const trimmed = raw.trim();

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    // Re-serialize to strip any injected fragments
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Normalizes a social handle: strips @ prefix and lowercases.
 * Returns null for empty input.
 */
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;

  const trimmed = raw.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed.toLowerCase();
}

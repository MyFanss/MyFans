import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

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

/**
 * Client-side validation aligned with backend DTOs (UpdateUserProfileDto / social).
 */

export function validateHttpsUrl(value: string, label: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return `${label} must use http or https`;
    }
    return undefined;
  } catch {
    return `Invalid ${label} URL`;
  }
}

export function validateXHandle(value: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const v = t.startsWith("@") ? t.slice(1) : t;
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(v)) {
    return "Invalid X handle (1–15 characters)";
  }
  return undefined;
}

export function validateInstagramHandle(value: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const v = t.startsWith("@") ? t.slice(1) : t;
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(v)) {
    return "Invalid Instagram username";
  }
  return undefined;
}

/** Optional: empty is OK; if set, must match backend rules. */
export function validateUsername(value: string): string | undefined {
  const t = value.trim();
  if (!t) return undefined;
  if (!/^[a-zA-Z0-9._]{3,30}$/.test(t)) {
    return "3–30 characters: letters, numbers, dots, underscores";
  }
  return undefined;
}

export function validateDisplayName(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (value.length > 100) return "Display name must be at most 100 characters";
  return undefined;
}

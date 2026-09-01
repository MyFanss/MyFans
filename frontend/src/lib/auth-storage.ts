const USER_ID_KEY = "myfans_user_id";
/** JWT access token persisted after login (aligned with api-utils `authToken`). */
const AUTH_TOKEN_KEY = "authToken";

/** Persisted after login (`token` / `userId` from POST /auth/login). */
export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function setStoredUserId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_ID_KEY, userId);
}

export function clearStoredUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_ID_KEY);
}

/** JWT from auth storage (localStorage `authToken`). */
export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Resolve JWT for API Authorization header.
 * Prefers stored token; optional NEXT_PUBLIC_DEV_AUTH_TOKEN in development only.
 */
export function resolveAuthToken(): string | null {
  const stored = getStoredAuthToken();
  if (stored) return stored;
  if (process.env.NODE_ENV === "development") {
    const fromEnv = process.env.NEXT_PUBLIC_DEV_AUTH_TOKEN?.trim();
    if (fromEnv) return fromEnv;
  }
  return null;
}

/** Dev fallback when nothing is in localStorage (development only). */
export function resolveUserId(): string | null {
  if (process.env.NODE_ENV === "development") {
    const fromEnv = process.env.NEXT_PUBLIC_DEV_USER_ID?.trim();
    if (fromEnv) return fromEnv;
  }
  return getStoredUserId();
}

export function hasStoredUserId(): boolean {
  return Boolean(resolveUserId());
}

export function hasStoredAuthToken(): boolean {
  return Boolean(resolveAuthToken());
}

export function clearAuthSession(): void {
  clearStoredUserId();
  clearStoredAuthToken();
}

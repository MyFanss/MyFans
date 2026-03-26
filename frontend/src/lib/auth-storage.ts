const USER_ID_KEY = "myfans_user_id";

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

/** Dev fallback when nothing is in localStorage (optional). */
export function resolveUserId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_DEV_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  return getStoredUserId();
}

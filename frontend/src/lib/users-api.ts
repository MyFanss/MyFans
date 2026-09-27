/**
 * Users API client.
 *
 * Covers the /api/v1/users endpoints used for onboarding role persistence,
 * profile reads, and the /users/me canonical identity call.
 *
 * Refs: #1828 (role persistence), ADR-001-role-model.md
 */

import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

/** Onboarding role intent, as selected by the user during onboarding. */
export type RoleIntent = 'creator' | 'fan' | 'both';

/** Canonical user record returned by the backend. */
export interface User {
  id: string;
  publicKey: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** True for creator and "both" accounts; false for pure fan accounts. */
  is_creator: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserPayload {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  /** Role cannot be self-elevated to admin; only fan↔creator changes allowed. */
  is_creator?: boolean;
}

// ── API helpers ────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's own profile.
 * Returns null on 401 (unauthenticated).
 */
export async function fetchMe(): Promise<User | null> {
  const res = await apiFetch('/api/v1/users/me');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`fetchMe failed: ${res.status}`);
  return (await res.json()) as User;
}

/**
 * Persist the onboarding role choice.
 *
 * Maps the three-way intent to the backend boolean:
 *   creator → is_creator: true
 *   fan     → is_creator: false
 *   both    → is_creator: true  (see ADR-001 §1)
 *
 * Self-elevation to admin is blocked by the backend; this client never sends
 * any admin flag.
 */
export async function persistRole(intent: RoleIntent): Promise<User> {
  const is_creator = intent === 'creator' || intent === 'both';
  const res = await apiFetch('/api/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ is_creator }),
  });
  if (!res.ok) throw new Error(`persistRole failed: ${res.status}`);
  return (await res.json()) as User;
}

/**
 * Update the current user's profile fields (username, displayName, etc.).
 * Does not allow changing is_creator directly — use persistRole() for that.
 */
export async function updateMe(payload: Omit<UpdateUserPayload, 'is_creator'>): Promise<User> {
  const res = await apiFetch('/api/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateMe failed: ${res.status}`);
  return (await res.json()) as User;
}

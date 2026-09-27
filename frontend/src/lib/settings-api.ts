/**
 * Settings API client.
 *
 * All mutating calls go through apiFetch which attaches CSRF headers
 * (see frontend/docs/CSRF.md and src/lib/api/client.ts).
 *
 * Covered endpoints:
 *   GET  /api/v1/settings         — fetch current settings
 *   PATCH /api/v1/settings        — update settings (CSRF required)
 *   DELETE /api/v1/users/me       — delete account (CSRF required)
 *   GET  /api/v1/spending-cap     — fetch current spending cap
 *   PATCH /api/v1/spending-cap    — update spending cap (CSRF required)
 *
 * Refs: #1827, frontend/docs/CSRF.md
 */

import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface UserSettings {
  /** XLM or USDC public key / G-address for payouts. Single source of truth. */
  payoutWallet: string | null;
  /** Display name shown on the creator profile. */
  displayName: string | null;
  /** Avatar URL. */
  avatarUrl: string | null;
}

export interface SpendingCap {
  /** Maximum spend per period, in the chosen asset. null = unlimited. */
  amountLimit: number | null;
  asset: string;
  periodDays: number;
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<UserSettings> {
  const res = await apiFetch('/api/v1/settings');
  if (!res.ok) throw new Error(`fetchSettings failed: ${res.status}`);
  return (await res.json()) as UserSettings;
}

/**
 * Update user settings.  CSRF token attached automatically by apiFetch.
 */
export async function updateSettings(payload: Partial<UserSettings>): Promise<UserSettings> {
  const res = await apiFetch('/api/v1/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateSettings failed: ${res.status}`);
  return (await res.json()) as UserSettings;
}

// ── Spending cap ──────────────────────────────────────────────────────────

export async function fetchSpendingCap(): Promise<SpendingCap> {
  const res = await apiFetch('/api/v1/spending-cap');
  if (!res.ok) throw new Error(`fetchSpendingCap failed: ${res.status}`);
  return (await res.json()) as SpendingCap;
}

/**
 * Update the spending cap.  CSRF token attached automatically by apiFetch.
 * Passing amountLimit: null disables the cap.
 * Passing amountLimit: 0 is treated as "no spend allowed" by the backend.
 */
export async function updateSpendingCap(payload: Partial<SpendingCap>): Promise<SpendingCap> {
  const res = await apiFetch('/api/v1/spending-cap', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateSpendingCap failed: ${res.status}`);
  return (await res.json()) as SpendingCap;
}

// ── Account deletion ──────────────────────────────────────────────────────

/**
 * Permanently delete the authenticated user's account.
 *
 * The caller MUST obtain explicit confirmation (the confirmation phrase
 * "delete my account") before calling this function.  The deletion is
 * irreversible.  CSRF token attached automatically by apiFetch.
 */
export async function deleteAccount(confirmationPhrase: string): Promise<void> {
  if (confirmationPhrase !== 'delete my account') {
    throw new Error('Confirmation phrase does not match.');
  }
  const res = await apiFetch('/api/v1/users/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation: confirmationPhrase }),
  });
  if (!res.ok) throw new Error(`deleteAccount failed: ${res.status}`);
}

'use client';

import type { WalletType } from '@/types/wallet';
import type { SubscriptionStatus } from '@/lib/subscription-status';

const WALLET_KEY = 'myfans.wallet.session.v1';
const SUBSCRIPTIONS_KEY = 'myfans.viewer.subscriptions.v1';

export interface WalletSession {
  address: string;
  walletType: WalletType;
}

type SubscriptionMap = Record<string, SubscriptionStatus>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or invalid client state should be cleared instead of crashing UI.
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeCreatorKey(creatorKey: string): string {
  return creatorKey.trim().toLowerCase();
}

export function getWalletSession(): WalletSession | null {
  const session = readJson<WalletSession>(WALLET_KEY);
  if (!session?.address || !session?.walletType) return null;
  return session;
}

export function setWalletSession(session: WalletSession): void {
  writeJson(WALLET_KEY, session);
}

export function clearWalletSession(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(WALLET_KEY);
}

export function getSubscriptionStatusForCreator(
  creatorKey: string,
): SubscriptionStatus | null {
  const normalized = normalizeCreatorKey(creatorKey);
  if (!normalized) return null;
  const map = readJson<SubscriptionMap>(SUBSCRIPTIONS_KEY) ?? {};
  return map[normalized] ?? null;
}

export function setSubscriptionStatusForCreator(
  creatorKey: string,
  status: SubscriptionStatus,
): void {
  const normalized = normalizeCreatorKey(creatorKey);
  if (!normalized) return;
  const map = readJson<SubscriptionMap>(SUBSCRIPTIONS_KEY) ?? {};
  map[normalized] = status;
  writeJson(SUBSCRIPTIONS_KEY, map);
}

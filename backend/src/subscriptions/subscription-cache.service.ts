import { Injectable } from '@nestjs/common';

const POSITIVE_TTL_MS = 60_000; // 1 minute for positive checks

interface CacheEntry {
  expiresAt: number;
}

/**
 * Short-lived in-memory cache for positive subscription checks.
 * Only caches "is subscriber = true" to avoid stale denials.
 */
@Injectable()
export class SubscriptionCacheService {
  private readonly store = new Map<string, CacheEntry>();

  private key(fan: string, creator: string): string {
    return `${fan}:${creator}`;
  }

  set(fan: string, creator: string): void {
    this.store.set(this.key(fan, creator), {
      expiresAt: Date.now() + POSITIVE_TTL_MS,
    });
  }

  get(fan: string, creator: string): boolean {
    const entry = this.store.get(this.key(fan, creator));
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.key(fan, creator));
      return false;
    }
    return true;
  }

  invalidate(fan: string, creator: string): void {
    this.store.delete(this.key(fan, creator));
  }
}

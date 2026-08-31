/**
 * Unit tests for notification-preferences lib.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
  invalidateCsrfToken: vi.fn(),
}));

import { getCsrfToken } from '@/lib/csrf';
import {
  DEFAULT_PREFERENCES,
  EVENT_TYPES,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '../notification-preferences';

// ── DEFAULT_PREFERENCES ────────────────────────────────────────────────────

describe('DEFAULT_PREFERENCES', () => {
  it('has email_notifications enabled by default', () => {
    expect(DEFAULT_PREFERENCES.email_notifications).toBe(true);
  });

  it('has push_notifications disabled by default', () => {
    expect(DEFAULT_PREFERENCES.push_notifications).toBe(false);
  });

  it('has marketing_emails disabled by default', () => {
    expect(DEFAULT_PREFERENCES.marketing_emails).toBe(false);
  });

  it('contains all per-event email keys', () => {
    for (const ev of EVENT_TYPES) {
      expect(DEFAULT_PREFERENCES).toHaveProperty(`email_${ev.key}`);
    }
  });

  it('contains all per-event push keys', () => {
    for (const ev of EVENT_TYPES) {
      expect(DEFAULT_PREFERENCES).toHaveProperty(`push_${ev.key}`);
    }
  });

  it('has boolean values for every key', () => {
    for (const val of Object.values(DEFAULT_PREFERENCES)) {
      expect(typeof val).toBe('boolean');
    }
  });
});

// ── EVENT_TYPES ────────────────────────────────────────────────────────────

describe('EVENT_TYPES', () => {
  it('has at least 4 event types', () => {
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(4);
  });

  it('each event has key, label, and description', () => {
    for (const ev of EVENT_TYPES) {
      expect(ev.key).toBeTruthy();
      expect(ev.label).toBeTruthy();
      expect(ev.description).toBeTruthy();
    }
  });

  it('includes new_subscriber event', () => {
    expect(EVENT_TYPES.some((e) => e.key === 'new_subscriber')).toBe(true);
  });

  it('includes payout event', () => {
    expect(EVENT_TYPES.some((e) => e.key === 'payout')).toBe(true);
  });
});

// ── fetchNotificationPreferences ──────────────────────────────────────────

describe('fetchNotificationPreferences', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('calls GET /users/me/notifications on the versioned API base', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => DEFAULT_PREFERENCES,
    });

    const result = await fetchNotificationPreferences();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/users/me/notifications',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual(DEFAULT_PREFERENCES);
  });

  it('uses same-origin /api/v1 when NEXT_PUBLIC_API_URL is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => DEFAULT_PREFERENCES,
    });

    await fetchNotificationPreferences();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/users/me/notifications',
      expect.any(Object),
    );
  });

  it('throws on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    await expect(fetchNotificationPreferences()).rejects.toThrow('Unauthorized');
  });
});

// ── saveNotificationPreferences ───────────────────────────────────────────

describe('saveNotificationPreferences', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    (getCsrfToken as ReturnType<typeof vi.fn>).mockResolvedValue('test-csrf-token');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls PATCH /users/me/notifications with body', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    const patch: Partial<NotificationPreferences> = { email_notifications: false };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Notification preferences updated successfully',
        preferences: DEFAULT_PREFERENCES,
      }),
    });

    await saveNotificationPreferences(patch);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/v1/users/me/notifications',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf-token' }),
      }),
    );
  });

  it('returns message and preferences on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: 'Notification preferences updated successfully',
        preferences: DEFAULT_PREFERENCES,
      }),
    });

    const result = await saveNotificationPreferences({});
    expect(result.message).toContain('updated');
    expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('throws on server error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal server error' }),
    });

    await expect(saveNotificationPreferences({})).rejects.toThrow('Internal server error');
  });
});

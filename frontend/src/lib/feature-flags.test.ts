import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FeatureFlag,
  defaultFeatureFlags,
  fetchRemoteFlags,
  getFeatureFlags,
  isFeatureEnabled,
  loadFeatureFlags,
  refreshFeatureFlags,
  resetFeatureFlagsForTests,
  setFeatureFlagOverride,
} from '@/lib/feature-flags';

describe('feature-flags', () => {
  beforeEach(() => {
    resetFeatureFlagsForTests();
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetFeatureFlagsForTests();
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns false when a flag is missing', () => {
    expect(isFeatureEnabled(FeatureFlag.BOOKMARKS)).toBe(false);
  });

  it('returns true when a flag is set in env', () => {
    vi.stubEnv('NEXT_PUBLIC_FLAG_BOOKMARKS', 'true');

    expect(isFeatureEnabled(FeatureFlag.BOOKMARKS)).toBe(true);
  });

  it('returns true when a flag is set in localStorage in non-production environments', () => {
    setFeatureFlagOverride(FeatureFlag.BOOKMARKS, true);

    expect(isFeatureEnabled(FeatureFlag.BOOKMARKS)).toBe(true);
  });

  it('ignores localStorage overrides in production builds', () => {
    vi.stubEnv('NODE_ENV', 'production');
    window.localStorage.setItem(`flags:${FeatureFlag.BOOKMARKS}`, 'true');

    expect(isFeatureEnabled(FeatureFlag.BOOKMARKS)).toBe(false);
  });

  it('returns safe defaults when remote flag fetching fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAGS_URL', 'https://flags.example.com/flags.json');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable')),
    );

    await expect(fetchRemoteFlags()).resolves.toEqual({});
    await expect(loadFeatureFlags()).resolves.toEqual(defaultFeatureFlags);
  });

  it('returns a full snapshot of all defined flags', () => {
    expect(getFeatureFlags()).toEqual(defaultFeatureFlags);
  });

  it('prefers remote flags over env and local overrides', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAGS_URL', 'https://flags.example.com/flags.json');
    vi.stubEnv('NEXT_PUBLIC_FLAG_BOOKMARKS', 'false');
    window.localStorage.setItem(`flags:${FeatureFlag.BOOKMARKS}`, 'false');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          flags: {
            [FeatureFlag.BOOKMARKS]: true,
          },
        }),
      }),
    );

    await loadFeatureFlags();

    expect(isFeatureEnabled(FeatureFlag.BOOKMARKS)).toBe(true);
  });

  it('refreshes remote flags so runtime toggles can change without a redeploy', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAGS_URL', 'https://flags.example.com/flags.json');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          flags: {
            [FeatureFlag.BOOKMARKS]: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          flags: {
            [FeatureFlag.BOOKMARKS]: true,
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadFeatureFlags()).resolves.toEqual(defaultFeatureFlags);
    await expect(refreshFeatureFlags()).resolves.toEqual({
      ...defaultFeatureFlags,
      [FeatureFlag.BOOKMARKS]: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

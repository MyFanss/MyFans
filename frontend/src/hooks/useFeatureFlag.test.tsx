import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import {
  FeatureFlag,
  FEATURE_FLAGS_REFRESH_INTERVAL_MS,
  resetFeatureFlagsForTests,
  setFeatureFlagOverride,
} from '@/lib/feature-flags';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function wrapper({ children }: { children: React.ReactNode }) {
  return <FeatureFlagsProvider>{children}</FeatureFlagsProvider>;
}

describe('useFeatureFlag', () => {
  beforeEach(() => {
    resetFeatureFlagsForTests();
    window.localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns false before flags load', () => {
    let resolveFetch: ((value: unknown) => void) | undefined;

    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAGS_URL', 'https://flags.example.com/flags.json');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const { result } = renderHook(() => useFeatureFlag(FeatureFlag.BOOKMARKS), {
      wrapper,
    });

    expect(result.current).toBe(false);

    act(() => {
      resolveFetch?.({
        ok: true,
        json: async () => ({
          flags: {
            [FeatureFlag.BOOKMARKS]: true,
          },
        }),
      });
    });
  });

  it('returns the correct value after flags load', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_FLAGS_URL', 'https://flags.example.com/flags.json');
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

    const { result } = renderHook(() => useFeatureFlag(FeatureFlag.BOOKMARKS), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('updates when a flag override changes', async () => {
    const { result } = renderHook(() => useFeatureFlag(FeatureFlag.BOOKMARKS), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    act(() => {
      setFeatureFlagOverride(FeatureFlag.BOOKMARKS, true);
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('refreshes remote flags on an interval so runtime rollouts update without a reload', async () => {
    vi.useFakeTimers();
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

    const { result } = renderHook(() => useFeatureFlag(FeatureFlag.BOOKMARKS), {
      wrapper,
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FEATURE_FLAGS_REFRESH_INTERVAL_MS);
    });

    expect(result.current).toBe(true);

    vi.useRealTimers();
  });
});

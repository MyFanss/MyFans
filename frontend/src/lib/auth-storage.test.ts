import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAuthToken, setAuthToken } from './auth-storage';

describe('auth-storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('does not throw when window is undefined (SSR path)', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate SSR where window is unavailable
    delete globalThis.window;

    try {
      await expect(setAuthToken('ssr-token')).resolves.toBeUndefined();
      await expect(clearAuthToken()).resolves.toBeUndefined();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('does not throw when localStorage is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage is not available');
      },
    });

    try {
      await expect(setAuthToken('no-storage-token')).resolves.toBeUndefined();
      await expect(clearAuthToken()).resolves.toBeUndefined();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});

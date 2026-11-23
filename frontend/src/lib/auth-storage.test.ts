import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_TOKEN_KEY, clearAuthToken, setAuthToken } from './auth-storage';

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

  it('expires the cookie with a Max-Age on sign-out (regression for #2204)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const cookieSetter = vi.fn();

    // The `cookie` accessor is defined somewhere on document's prototype
    // chain (exactly where varies by DOM implementation); walk up to find
    // it so this test doesn't assume a specific prototype.
    let owner: object | null = document;
    let originalCookieDescriptor: PropertyDescriptor | undefined;
    while (owner) {
      originalCookieDescriptor = Object.getOwnPropertyDescriptor(owner, 'cookie');
      if (originalCookieDescriptor) break;
      owner = Object.getPrototypeOf(owner);
    }
    owner ??= document;

    Object.defineProperty(owner, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSetter,
    });

    try {
      await clearAuthToken();
      expect(cookieSetter).toHaveBeenCalledTimes(1);
      const written = cookieSetter.mock.calls[0][0] as string;
      // A Max-Age (rather than just `expires`) means this isn't left as a
      // session cookie that would otherwise outlive — or be outlived by —
      // any other copy of the token (#2204).
      expect(written).toContain('Max-Age=0');
      expect(written).toContain(`${AUTH_TOKEN_KEY}=`);
    } finally {
      if (originalCookieDescriptor) {
        Object.defineProperty(owner, 'cookie', originalCookieDescriptor);
      } else {
        // @ts-expect-error restoring a property we only partially know the shape of
        delete owner.cookie;
      }
    }
  });

  it('clears both the cookie and any legacy localStorage copy on sign-out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    window.localStorage.setItem(AUTH_TOKEN_KEY, 'stale-legacy-token');

    await clearAuthToken();

    expect(window.localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });
});

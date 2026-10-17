import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from './auth-storage';

describe('auth-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('returns null when storage is empty', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('writes and reads back a token', () => {
    setAuthToken('test-token-123');
    expect(getAuthToken()).toBe('test-token-123');
  });

  it('clears the token on sign-out', () => {
    setAuthToken('test-token-123');
    expect(getAuthToken()).toBe('test-token-123');

    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });

  it('does not throw when window is undefined (SSR path)', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulate SSR where window is unavailable
    delete globalThis.window;

    try {
      expect(() => getAuthToken()).not.toThrow();
      expect(() => setAuthToken('ssr-token')).not.toThrow();
      expect(() => clearAuthToken()).not.toThrow();
      expect(getAuthToken()).toBeNull();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it('does not throw when localStorage is unavailable', () => {
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage is not available');
      },
    });

    try {
      expect(() => getAuthToken()).not.toThrow();
      expect(() => setAuthToken('no-storage-token')).not.toThrow();
      expect(() => clearAuthToken()).not.toThrow();
      expect(getAuthToken()).toBeNull();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});

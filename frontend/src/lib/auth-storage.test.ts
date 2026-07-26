import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStoredUserId,
  setStoredUserId,
  clearStoredUserId,
  resolveUserId,
  hasStoredUserId,
} from './auth-storage';

describe('auth-storage', () => {
  const USER_ID_KEY = 'myfans_user_id';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getStoredUserId', () => {
    it('returns null when userId is not stored', () => {
      expect(getStoredUserId()).toBeNull();
    });

    it('returns stored userId from localStorage', () => {
      const testId = 'user-123';
      localStorage.setItem(USER_ID_KEY, testId);
      expect(getStoredUserId()).toBe(testId);
    });
  });

  describe('setStoredUserId', () => {
    it('stores userId in localStorage', () => {
      const testId = 'user-456';
      setStoredUserId(testId);
      expect(localStorage.getItem(USER_ID_KEY)).toBe(testId);
    });
  });

  describe('clearStoredUserId', () => {
    it('removes userId from localStorage', () => {
      const testId = 'user-789';
      localStorage.setItem(USER_ID_KEY, testId);
      clearStoredUserId();
      expect(localStorage.getItem(USER_ID_KEY)).toBeNull();
    });
  });

  describe('resolveUserId', () => {
    it('returns stored userId when available', () => {
      const testId = 'user-stored';
      setStoredUserId(testId);
      expect(resolveUserId()).toBe(testId);
    });

    it('uses DEV_USER_ID fallback in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_DEV_USER_ID = 'dev-user-123';

      expect(resolveUserId()).toBe('dev-user-123');

      process.env.NODE_ENV = originalEnv;
      delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    });

    it('ignores DEV_USER_ID in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_DEV_USER_ID = 'dev-user-456';

      expect(resolveUserId()).toBeNull();

      process.env.NODE_ENV = originalEnv;
      delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    });

    it('prefers stored userId over DEV_USER_ID in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_DEV_USER_ID = 'dev-user-789';

      const storedId = 'user-stored-prod';
      setStoredUserId(storedId);

      expect(resolveUserId()).toBe(storedId);

      process.env.NODE_ENV = originalEnv;
      delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    });
  });

  describe('hasStoredUserId', () => {
    it('returns false when no userId is available', () => {
      expect(hasStoredUserId()).toBe(false);
    });

    it('returns true when userId is stored', () => {
      setStoredUserId('user-has-id');
      expect(hasStoredUserId()).toBe(true);
    });

    it('returns true when DEV_USER_ID is available in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_DEV_USER_ID = 'dev-fallback';

      expect(hasStoredUserId()).toBe(true);

      process.env.NODE_ENV = originalEnv;
      delete process.env.NEXT_PUBLIC_DEV_USER_ID;
    });
  });
});

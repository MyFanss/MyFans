import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getActiveNetwork, normalizeNetwork } from './network';

/**
 * Closes #2211: unit tests for `getActiveNetwork` (and the `normalizeNetwork`
 * helper it relies on), covering the public/mainnet alias, case-insensitivity,
 * an unset/empty value, and an unknown value falling back to testnet.
 */
describe('network.ts', () => {
  const ENV_KEY = 'NEXT_PUBLIC_STELLAR_NETWORK';
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  describe('getActiveNetwork', () => {
    it('returns public for "public"', () => {
      process.env[ENV_KEY] = 'public';
      expect(getActiveNetwork()).toBe('public');
    });

    it('returns public for "mainnet" (alias)', () => {
      process.env[ENV_KEY] = 'mainnet';
      expect(getActiveNetwork()).toBe('public');
    });

    it('is case-insensitive ("TESTNET")', () => {
      process.env[ENV_KEY] = 'TESTNET';
      expect(getActiveNetwork()).toBe('testnet');
    });

    it('returns futurenet for "futurenet"', () => {
      process.env[ENV_KEY] = 'futurenet';
      expect(getActiveNetwork()).toBe('futurenet');
    });

    it('defaults to testnet for an empty string', () => {
      process.env[ENV_KEY] = '';
      expect(getActiveNetwork()).toBe('testnet');
    });

    it('defaults to testnet when unset', () => {
      expect(getActiveNetwork()).toBe('testnet');
    });

    it('falls back to testnet for an unknown value', () => {
      process.env[ENV_KEY] = 'not-a-real-network';
      expect(getActiveNetwork()).toBe('testnet');
    });
  });

  describe('normalizeNetwork', () => {
    it('returns null for an unrecognized value', () => {
      expect(normalizeNetwork('not-a-real-network')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(normalizeNetwork(null)).toBeNull();
      expect(normalizeNetwork(undefined)).toBeNull();
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  compareNetworks,
  isKnownNetwork,
  normalizeNetwork,
} from './networkGuard';

describe('normalizeNetwork', () => {
  it('normalizes known network strings', () => {
    expect(normalizeNetwork('mainnet')).toBe('mainnet');
    expect(normalizeNetwork('testnet')).toBe('testnet');
    expect(normalizeNetwork('futurenet')).toBe('futurenet');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeNetwork('  TESTNET ')).toBe('testnet');
    expect(normalizeNetwork('FutureNet')).toBe('futurenet');
  });

  it('returns unknown for undefined, null, and non-string values', () => {
    expect(normalizeNetwork(undefined)).toBe('unknown');
    expect(normalizeNetwork(null)).toBe('unknown');
    expect(normalizeNetwork(42)).toBe('unknown');
    expect(normalizeNetwork({})).toBe('unknown');
  });

  it('returns unknown for unrecognized network strings', () => {
    expect(normalizeNetwork('devnet')).toBe('unknown');
    expect(normalizeNetwork('')).toBe('unknown');
  });
});

describe('isKnownNetwork', () => {
  it('recognizes known networks', () => {
    expect(isKnownNetwork('mainnet')).toBe(true);
    expect(isKnownNetwork('testnet')).toBe(true);
    expect(isKnownNetwork('futurenet')).toBe(true);
  });

  it('rejects unknown and undefined values', () => {
    expect(isKnownNetwork('unknown')).toBe(false);
    expect(isKnownNetwork(undefined)).toBe(false);
    expect(isKnownNetwork('devnet')).toBe(false);
  });
});

describe('compareNetworks', () => {
  it('reports no mismatch when networks match', () => {
    const result = compareNetworks('testnet', 'testnet');
    expect(result.mismatch).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('reports a mismatch when networks differ', () => {
    const result = compareNetworks('testnet', 'futurenet');
    expect(result.mismatch).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('testnet');
    expect(result.reason).toContain('futurenet');
  });

  it('treats testnet vs mainnet as a mismatch', () => {
    expect(compareNetworks('testnet', 'mainnet').mismatch).toBe(true);
  });

  it('fails closed when the actual network is unknown', () => {
    const result = compareNetworks('testnet', 'unknown');
    expect(result.mismatch).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.reason).not.toBeNull();
  });

  it('fails closed when the actual network is undefined', () => {
    const result = compareNetworks('testnet', undefined);
    expect(result.mismatch).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it('does not throw for unknown or undefined inputs', () => {
    expect(() => compareNetworks(undefined, undefined)).not.toThrow();
    expect(() => compareNetworks('unknown', 'unknown')).not.toThrow();
  });
});

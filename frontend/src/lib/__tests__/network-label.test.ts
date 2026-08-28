import { describe, it, expect } from 'vitest';
import { stellarNetworkLabel, isPublicStellarNetwork } from '../network-label';

describe('stellarNetworkLabel', () => {
  it('labels a testnet build as "Stellar Testnet" (no Mainnet string)', () => {
    expect(stellarNetworkLabel('testnet')).toBe('Stellar Testnet');
  });

  it('labels a futurenet build as "Stellar Futurenet"', () => {
    expect(stellarNetworkLabel('futurenet')).toBe('Stellar Futurenet');
  });

  it('labels mainnet/public as "Stellar Public"', () => {
    expect(stellarNetworkLabel('mainnet')).toBe('Stellar Public');
    expect(stellarNetworkLabel('public')).toBe('Stellar Public');
  });

  it('is case-insensitive', () => {
    expect(stellarNetworkLabel('TESTNET')).toBe('Stellar Testnet');
    expect(stellarNetworkLabel('  Mainnet  ')).toBe('Stellar Public');
  });

  it('falls back to a neutral "Stellar" for unknown / empty values', () => {
    expect(stellarNetworkLabel('')).toBe('Stellar');
    expect(stellarNetworkLabel(undefined)).toBe('Stellar');
    expect(stellarNetworkLabel(null)).toBe('Stellar');
  });

  it('never emits "Mainnet" for a non-public network', () => {
    for (const network of ['testnet', 'futurenet', '', 'sandbox']) {
      expect(stellarNetworkLabel(network)).not.toMatch(/mainnet/i);
    }
  });
});

describe('isPublicStellarNetwork', () => {
  it('is true only for public-network ids / labels', () => {
    expect(isPublicStellarNetwork('mainnet')).toBe(true);
    expect(isPublicStellarNetwork('public')).toBe(true);
    expect(isPublicStellarNetwork('Stellar Public')).toBe(true);
  });

  it('is false for testnet / futurenet / unknown', () => {
    expect(isPublicStellarNetwork('testnet')).toBe(false);
    expect(isPublicStellarNetwork('Stellar Testnet')).toBe(false);
    expect(isPublicStellarNetwork('futurenet')).toBe(false);
    expect(isPublicStellarNetwork('')).toBe(false);
    expect(isPublicStellarNetwork(undefined)).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_PASSPHRASES, getConfiguredNetwork, guardNetwork, networkFromPassphrase, networkLabel } from './network';

describe('network.ts', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('getConfiguredNetwork maps aliases and defaults', () => {
    const cases: [string, string][] = [
      ['mainnet', 'mainnet'], ['public', 'mainnet'],
      ['testnet', 'testnet'], ['test', 'testnet'],
      ['futurenet', 'futurenet'], ['standalone', 'standalone'], ['local', 'standalone'],
    ];
    for (const [input, expected] of cases) expect(getConfiguredNetwork(input)).toBe(expected);
    expect(getConfiguredNetwork('unrecognized')).toBe('unknown');
    expect(getConfiguredNetwork()).toBe('testnet');
    vi.stubEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'public');
    expect(getConfiguredNetwork()).toBe('mainnet');
  });

  it('networkFromPassphrase maps passphrases', () => {
    for (const [net, pass] of Object.entries(NETWORK_PASSPHRASES)) expect(networkFromPassphrase(pass)).toBe(net);
    expect(networkFromPassphrase(null)).toBe('unknown');
    expect(networkFromPassphrase('')).toBe('unknown');
    expect(networkFromPassphrase('other')).toBe('unknown');
  });

  it('networkLabel formats names', () => {
    expect(networkLabel('testnet')).toBe('Testnet');
    expect(networkLabel('unknown')).toBe('Unknown network');
  });

  it('guardNetwork handles match and error cases', () => {
    expect(guardNetwork(NETWORK_PASSPHRASES.testnet, 'testnet')).toEqual({ ok: true, configured: 'testnet', wallet: 'testnet' });
    const unkCfg = guardNetwork(NETWORK_PASSPHRASES.testnet, 'invalid');
    expect(unkCfg.ok).toBe(false);
    expect(unkCfg.message).toBeTruthy();
    const unkWal = guardNetwork('invalid', 'testnet');
    expect(unkWal.ok).toBe(false);
    expect(unkWal.message).toBeTruthy();
    const mismatch = guardNetwork(NETWORK_PASSPHRASES.mainnet, 'testnet');
    expect(mismatch.ok).toBe(false);
    expect(mismatch.message).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';
import {
  getWalletConnectConfig,
  isWalletConnectComingSoon,
  isWalletConnectEnabled,
  WALLETCONNECT_ENABLED_FLAG,
  WALLETCONNECT_PROJECT_ID_ENV,
} from './walletconnect';

/**
 * #2214: getWalletConnectConfig is the safety check that keeps WalletConnect
 * off by default. These tests pass a fake env object so they never read (or
 * depend on) the real process.env, and never import a module that opens a
 * WalletConnect socket (connectWalletConnect / getSignClient are untouched).
 */
describe('getWalletConnectConfig', () => {
  it('enables the feature only when the flag is exactly "true"', () => {
    const enabled = getWalletConnectConfig({
      [WALLETCONNECT_ENABLED_FLAG]: 'true',
      [WALLETCONNECT_PROJECT_ID_ENV]: 'proj-123',
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.projectId).toBe('proj-123');
  });

  it('treats "TRUE" (any other casing) as off', () => {
    const config = getWalletConnectConfig({ [WALLETCONNECT_ENABLED_FLAG]: 'TRUE' });
    expect(config.enabled).toBe(false);
  });

  it('treats a missing flag as off', () => {
    const config = getWalletConnectConfig({});
    expect(config.enabled).toBe(false);
    expect(config.projectId).toBeNull();
  });

  it('returns null projectId when the flag is "true" but the project id is blank', () => {
    const config = getWalletConnectConfig({
      [WALLETCONNECT_ENABLED_FLAG]: 'true',
      [WALLETCONNECT_PROJECT_ID_ENV]: '   ',
    });
    expect(config.enabled).toBe(true);
    expect(config.projectId).toBeNull();
  });

  it('returns null projectId when the project id env var is absent', () => {
    const config = getWalletConnectConfig({ [WALLETCONNECT_ENABLED_FLAG]: 'true' });
    expect(config.projectId).toBeNull();
  });
});

describe('isWalletConnectEnabled / isWalletConnectComingSoon', () => {
  it('coming soon is true when the flag is off', () => {
    const env = {};
    expect(isWalletConnectEnabled(env)).toBe(false);
    expect(isWalletConnectComingSoon(env)).toBe(true);
  });

  it('coming soon is false (inverse of enabled) when the flag is on', () => {
    const env = { [WALLETCONNECT_ENABLED_FLAG]: 'true' };
    expect(isWalletConnectEnabled(env)).toBe(true);
    expect(isWalletConnectComingSoon(env)).toBe(false);
  });

  it('coming soon stays true for a non-"true" value such as "yes" or "1"', () => {
    expect(isWalletConnectComingSoon({ [WALLETCONNECT_ENABLED_FLAG]: 'yes' })).toBe(true);
    expect(isWalletConnectComingSoon({ [WALLETCONNECT_ENABLED_FLAG]: '1' })).toBe(true);
  });
});

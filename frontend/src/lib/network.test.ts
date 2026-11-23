import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// NETWORK_GUARD delegates the actual comparison to checkNetworkGuard. Mocking
// it here isolates what we're testing: which "active network" NETWORK_GUARD
// resolves to and passes along, not the comparison logic itself (that's
// covered by stellar/networkGuard.test.ts). No wallet connection is needed.
vi.mock('./stellar/networkGuard', () => ({
  checkNetworkGuard: vi.fn(() => ({ ok: true, expected: 'TESTNET', actual: 'TESTNET' })),
}));

import { checkNetworkGuard } from './stellar/networkGuard';
import { NETWORK_GUARD } from './network';

const mockedCheckNetworkGuard = vi.mocked(checkNetworkGuard);

describe('NETWORK_GUARD', () => {
  const ENV_KEY = 'NEXT_PUBLIC_STELLAR_NETWORK';
  const originalValue = process.env[ENV_KEY];

  beforeEach(() => {
    mockedCheckNetworkGuard.mockClear();
  });

  afterEach(() => {
    // Restore the environment exactly as it was before this suite touched it.
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it('calls the guard with the fallback network when the env var is unset (regression for #2218)', () => {
    delete process.env[ENV_KEY];

    NETWORK_GUARD('testnet');

    // getActiveNetwork() falls back to 'testnet' when the env var is unset
    // (frontend/src/config/network.ts). Asserting the exact fallback string
    // NETWORK_GUARD actually passes today, so this test breaks loudly if
    // that fallback is ever removed or changed, per #2218.
    expect(mockedCheckNetworkGuard).toHaveBeenCalledTimes(1);
    expect(mockedCheckNetworkGuard).toHaveBeenCalledWith('testnet', 'testnet');
  });

  it('passes through a configured network when the env var is set', () => {
    process.env[ENV_KEY] = 'public';

    NETWORK_GUARD('public');

    expect(mockedCheckNetworkGuard).toHaveBeenCalledTimes(1);
    expect(mockedCheckNetworkGuard).toHaveBeenCalledWith('public', 'public');
  });

  it('restores the environment variable after each test', () => {
    expect(process.env[ENV_KEY]).toBe(originalValue);
  });
});

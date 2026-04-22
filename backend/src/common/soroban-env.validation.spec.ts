import {
  ALLOWED_STELLAR_NETWORKS,
  validateSorobanEnv,
} from './soroban-env.validation';

describe('validateSorobanEnv', () => {
  const validBase = {
    STELLAR_NETWORK: 'testnet',
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
  };

  it('accepts minimal valid configuration', () => {
    expect(() => validateSorobanEnv(validBase)).not.toThrow();
  });

  it('accepts each allowed network (case-insensitive)', () => {
    for (const n of ALLOWED_STELLAR_NETWORKS) {
      expect(() =>
        validateSorobanEnv({
          ...validBase,
          STELLAR_NETWORK: n.toUpperCase(),
        }),
      ).not.toThrow();
    }
  });

  it('rejects missing STELLAR_NETWORK', () => {
    expect(() =>
      validateSorobanEnv({
        SOROBAN_RPC_URL: validBase.SOROBAN_RPC_URL,
      }),
    ).toThrow(/STELLAR_NETWORK is required/);
  });

  it('rejects blank STELLAR_NETWORK', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        STELLAR_NETWORK: '   ',
      }),
    ).toThrow(/STELLAR_NETWORK is required/);
  });

  it('rejects unsupported STELLAR_NETWORK', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        STELLAR_NETWORK: 'localnet',
      }),
    ).toThrow(/not supported/);
  });

  it('rejects missing SOROBAN_RPC_URL', () => {
    expect(() =>
      validateSorobanEnv({
        STELLAR_NETWORK: validBase.STELLAR_NETWORK,
      }),
    ).toThrow(/SOROBAN_RPC_URL is required/);
  });

  it('rejects invalid SOROBAN_RPC_URL', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_RPC_URL: 'not-a-url',
      }),
    ).toThrow(/not a valid URL/);
  });

  it('rejects non-http(s) SOROBAN_RPC_URL', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_RPC_URL: 'ftp://example.com/rpc',
      }),
    ).toThrow(/http or https/);
  });

  it('accepts unset SOROBAN_RPC_TIMEOUT (optional)', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_RPC_TIMEOUT: undefined,
      }),
    ).not.toThrow();
  });

  it('rejects invalid SOROBAN_RPC_TIMEOUT when set', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_RPC_TIMEOUT: '0',
      }),
    ).toThrow(/positive integer/);
  });

  it('rejects SOROBAN_RPC_TIMEOUT that is too large', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_RPC_TIMEOUT: '90000000',
      }),
    ).toThrow(/unreasonably large/);
  });

  it('accepts optional SOROBAN_HEALTH_CHECK_CONTRACT when valid', () => {
    const c =
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_HEALTH_CHECK_CONTRACT: c,
      }),
    ).not.toThrow();
  });

  it('rejects invalid SOROBAN_HEALTH_CHECK_CONTRACT when set', () => {
    expect(() =>
      validateSorobanEnv({
        ...validBase,
        SOROBAN_HEALTH_CHECK_CONTRACT: 'short',
      }),
    ).toThrow(/valid Soroban contract strkey/);
  });

  it('aggregates multiple errors in one message', () => {
    try {
      validateSorobanEnv({});
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      const msg = (e as Error).message;
      expect(msg).toContain('STELLAR_NETWORK');
      expect(msg).toContain('SOROBAN_RPC_URL');
    }
  });
});

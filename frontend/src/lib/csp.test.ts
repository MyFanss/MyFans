import { describe, expect, it } from 'vitest';
import {
  buildConnectSrcHosts,
  buildContentSecurityPolicy,
  DEFAULT_STELLAR_CONNECT_HOSTS,
  extractHost,
} from '@/lib/csp';

/**
 * Regression tests for the CSP `connect-src` allowlist.
 *
 * CSP changes are easy to get wrong silently: a well-meaning refactor of
 * next.config.ts (or of src/lib/csp.ts) can drop a Stellar host from the
 * policy and nothing will fail until a wallet extension starts throwing
 * CSP violations in production. These tests pin the critical hosts down
 * so that regression shows up as a failing test instead.
 *
 * See docs/CSP.md for the update process this suite is meant to protect.
 */

const API_HOST = 'localhost:3001';

describe('extractHost', () => {
  it('extracts host:port from a URL with a non-default port', () => {
    expect(extractHost('https://custom-rpc.example.com:8443/soroban')).toBe(
      'custom-rpc.example.com:8443',
    );
  });

  it('extracts a bare host when no port is present', () => {
    expect(extractHost('https://soroban-testnet.stellar.org')).toBe(
      'soroban-testnet.stellar.org',
    );
  });

  it('returns null for missing or invalid values', () => {
    expect(extractHost(undefined)).toBeNull();
    expect(extractHost('')).toBeNull();
    expect(extractHost('not a url')).toBeNull();
  });
});

describe('buildConnectSrcHosts', () => {
  it('always includes every default Stellar/Soroban host', () => {
    const hosts = buildConnectSrcHosts(API_HOST, {});

    for (const stellarHost of DEFAULT_STELLAR_CONNECT_HOSTS) {
      expect(hosts).toContain(stellarHost);
    }
  });

  it('includes the API origin host', () => {
    const hosts = buildConnectSrcHosts(API_HOST, {});
    expect(hosts).toContain(API_HOST);
  });

  it('adds the configured NEXT_PUBLIC_SOROBAN_RPC_URL host', () => {
    const hosts = buildConnectSrcHosts(API_HOST, {
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://my-private-soroban-rpc.example.com',
    });

    expect(hosts).toContain('my-private-soroban-rpc.example.com');
  });

  it('adds the configured NEXT_PUBLIC_HORIZON_URL host', () => {
    const hosts = buildConnectSrcHosts(API_HOST, {
      NEXT_PUBLIC_HORIZON_URL: 'https://my-horizon.example.com:4433',
    });

    expect(hosts).toContain('my-horizon.example.com:4433');
  });

  it('dedupes when a configured host matches a default host', () => {
    const hosts = buildConnectSrcHosts(API_HOST, {
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://mainnet.sorobanrpc.com',
    });

    expect(hosts.filter((host) => host === 'mainnet.sorobanrpc.com')).toHaveLength(1);
  });

  it('does not allow arbitrary unconfigured hosts', () => {
    const hosts = buildConnectSrcHosts(API_HOST, {});
    expect(hosts).not.toContain('evil.example.com');
  });
});

describe('buildContentSecurityPolicy', () => {
  it('produces a connect-src directive containing the critical wallet hosts', () => {
    const csp = buildContentSecurityPolicy({
      apiHost: API_HOST,
      isProd: true,
      env: {
        NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://my-private-soroban-rpc.example.com',
      },
    });

    const connectSrcLine = csp
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('connect-src'));

    expect(connectSrcLine).toBeDefined();
    expect(connectSrcLine).toContain("'self'");
    expect(connectSrcLine).toContain(API_HOST);
    expect(connectSrcLine).toContain('my-private-soroban-rpc.example.com');

    for (const stellarHost of DEFAULT_STELLAR_CONNECT_HOSTS) {
      expect(connectSrcLine).toContain(stellarHost);
    }
  });

  it('fails fast if a required Stellar host is dropped from the default list', () => {
    // Guards against someone editing DEFAULT_STELLAR_CONNECT_HOSTS and
    // removing a host that wallets depend on (e.g. mainnet Soroban RPC).
    expect(DEFAULT_STELLAR_CONNECT_HOSTS).toEqual(
      expect.arrayContaining([
        '*.stellar.org',
        'mainnet.sorobanrpc.com',
        'rpc-futurenet.stellar.org',
      ]),
    );
  });

  it('includes localhost sources only outside production', () => {
    const devCsp = buildContentSecurityPolicy({ apiHost: API_HOST, isProd: false, env: {} });
    const prodCsp = buildContentSecurityPolicy({ apiHost: API_HOST, isProd: true, env: {} });

    expect(devCsp).toContain('localhost:*');
    expect(prodCsp).not.toContain('localhost:*');
  });
});

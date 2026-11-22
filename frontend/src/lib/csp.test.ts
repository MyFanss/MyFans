import { describe, it, expect } from 'vitest';
import { buildContentSecurityPolicy } from './csp';

const STELLAR_HOSTS = [
  'https://horizon-testnet.stellar.org',
  'https://horizon.stellar.org',
  'https://soroban-testnet.stellar.org',
  'https://soroban.stellar.org',
];

const FREIGHTER_ORIGIN = 'chrome-extension://bcacbicbmjbfjfjjdgmglmhcebkmnffn';

function toDirectiveMap(policy: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const directive of policy.split('; ')) {
    const [name, ...values] = directive.split(' ');
    map[name] = values.join(' ');
  }
  return map;
}

describe('buildContentSecurityPolicy', () => {
  const apiHost = 'api.example.com';

  it('produces the expected directive set for production', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: true });
    const directives = toDirectiveMap(policy);

    expect(Object.keys(directives).sort()).toEqual(
      [
        'base-uri',
        'connect-src',
        'default-src',
        'font-src',
        'frame-ancestors',
        'img-src',
        'object-src',
        'script-src',
        'style-src',
      ].sort(),
    );

    expect(directives['frame-ancestors']).toBe("'none'");
    expect(directives['object-src']).toBe("'none'");
    expect(directives['base-uri']).toBe("'self'");
  });

  it('includes required connect-src origins', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: true });
    const connectSrc = toDirectiveMap(policy)['connect-src'];

    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain(`https://${apiHost}`);
    for (const host of STELLAR_HOSTS) {
      expect(connectSrc).toContain(host);
    }
    expect(connectSrc).toContain(FREIGHTER_ORIGIN);
  });

  it('appends extraConnectSrc entries to connect-src', () => {
    const policy = buildContentSecurityPolicy({
      apiHost,
      isProd: true,
      extraConnectSrc: ['https://rpc.example.com'],
    });
    const connectSrc = toDirectiveMap(policy)['connect-src'];

    expect(connectSrc).toContain('https://rpc.example.com');
  });

  it('includes the WalletConnect relay hosts when walletConnectEnabled is true, even in production', () => {
    const policy = buildContentSecurityPolicy({
      apiHost,
      isProd: true,
      walletConnectEnabled: true,
    });
    const connectSrc = toDirectiveMap(policy)['connect-src'];

    expect(connectSrc).toContain('wss://relay.walletconnect.com');
    expect(connectSrc).toContain('wss://relay.walletconnect.org');
    expect(connectSrc).toContain('https://verify.walletconnect.com');
  });

  it('omits the WalletConnect relay hosts when the flag is off or unset', () => {
    const offPolicy = buildContentSecurityPolicy({
      apiHost,
      isProd: true,
      walletConnectEnabled: false,
    });
    const unsetPolicy = buildContentSecurityPolicy({ apiHost, isProd: true });

    for (const policy of [offPolicy, unsetPolicy]) {
      const connectSrc = toDirectiveMap(policy)['connect-src'];
      expect(connectSrc).not.toContain('walletconnect');
    }
  });

  it('never introduces a bare wildcard in connect-src, even with WalletConnect enabled', () => {
    const policy = buildContentSecurityPolicy({
      apiHost,
      isProd: true,
      walletConnectEnabled: true,
    });
    const connectSrc = toDirectiveMap(policy)['connect-src'];

    expect(connectSrc.split(' ')).not.toContain('*');
  });

  it('omits unsafe-eval from script-src in production', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: true });
    const scriptSrc = toDirectiveMap(policy)['script-src'];

    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('includes unsafe-eval in script-src for development', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: false });
    const scriptSrc = toDirectiveMap(policy)['script-src'];

    expect(scriptSrc).toBe("'self' 'unsafe-eval'");
  });
});

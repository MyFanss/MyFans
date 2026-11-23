import { describe, it, expect } from 'vitest';
import { buildContentSecurityPolicy } from './csp';
import { getRemoteImagePatterns } from './image-remote-patterns';

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
    const directives = toDirectiveMap(policy);

    expect(directives['script-src']).not.toContain("'unsafe-eval'");
    // Regression for #2216: production must stay locked down on these two
    // directives regardless of the script-src branch taken.
    expect(directives['frame-ancestors']).toBe("'none'");
    expect(directives['object-src']).toBe("'none'");
  });

  it('includes unsafe-eval in script-src for development', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: false });
    const directives = toDirectiveMap(policy);

    expect(directives['script-src']).toBe("'self' 'unsafe-eval'");
    // Regression for #2216: frame-ancestors/object-src must not loosen in
    // development just because unsafe-eval is allowed there.
    expect(directives['frame-ancestors']).toBe("'none'");
    expect(directives['object-src']).toBe("'none'");
  });

  it('does not allow images from every HTTPS host', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: true });
    const imgSrc = toDirectiveMap(policy)['img-src'];
    const tokens = imgSrc.split(' ');

    // A bare `https:` source would let any HTTPS host be used as an image
    // (and therefore a fan-tracking pixel); only specific origins allowed.
    expect(tokens).not.toContain('https:');
  });

  it('allows exactly the hosts from getRemoteImagePatterns for images', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: true });
    const imgSrc = toDirectiveMap(policy)['img-src'];

    for (const pattern of getRemoteImagePatterns()) {
      const protocol = pattern.protocol ?? 'https';
      const hostname = pattern.hostname.startsWith('**.')
        ? `*.${pattern.hostname.slice(3)}`
        : pattern.hostname;
      expect(imgSrc).toContain(`${protocol}://${hostname}`);
    }
  });

  it('still allows data: and blob: image sources for previews', () => {
    const policy = buildContentSecurityPolicy({ apiHost, isProd: true });
    const imgSrc = toDirectiveMap(policy)['img-src'];

    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');
  });
});

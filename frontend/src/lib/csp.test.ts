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

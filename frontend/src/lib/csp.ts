/**
 * Content Security Policy builder.
 *
 * Produces a strict CSP that allows the app to function while blocking
 * inline script injection and untrusted hosts. See docs/CSP.md for the
 * full allowlist rationale.
 */
import { getRemoteImagePatterns } from './image-remote-patterns';

interface CspOptions {
  apiHost: string;
  isProd: boolean;
  extraConnectSrc?: string[];
}

const STELLAR_HOSTS = [
  'https://horizon-testnet.stellar.org',
  'https://horizon.stellar.org',
  'https://soroban-testnet.stellar.org',
  'https://soroban.stellar.org',
];

const WALLET_EXTENSION_ORIGINS = [
  // Freighter injects a content script; its origin appears as the extension
  'chrome-extension://bcacfldlkkdogcmkkibnjlakofdplcbk',
];

/**
 * Derive the `img-src` origin list from the same remote-pattern helper that
 * next/image uses, so the CSP can never be wider than the hosts Next is
 * actually willing to proxy images from. A bare `https:` scheme source would
 * undo that allowlist entirely, letting any creator-controlled URL be used
 * as a fan-tracking pixel.
 */
function remoteImageOrigins(): string[] {
  return getRemoteImagePatterns().map((pattern) => {
    const protocol = pattern.protocol ?? 'https';
    // `next/image` remote patterns support a `**.` prefix to match any
    // number of subdomain levels. CSP source-list hosts only support a
    // single leading `*` wildcard label, so collapse `**.` to `*.`.
    const hostname = pattern.hostname.startsWith('**.')
      ? `*.${pattern.hostname.slice(3)}`
      : pattern.hostname;
    return `${protocol}://${hostname}`;
  });
}

export function buildContentSecurityPolicy(options: CspOptions): string {
  const { apiHost, isProd, extraConnectSrc = [] } = options;

  const connectSrc = [
    "'self'",
    `https://${apiHost}`,
    ...STELLAR_HOSTS,
    ...WALLET_EXTENSION_ORIGINS,
    ...extraConnectSrc,
  ].join(' ');

  const imgSrc = ["'self'", 'data:', 'blob:', ...remoteImageOrigins()].join(' ');

  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self'${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join('; ');
}

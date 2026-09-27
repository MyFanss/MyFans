/**
 * Content Security Policy builder.
 *
 * Produces a strict CSP that allows the app to function while blocking
 * inline script injection and untrusted hosts. See docs/CSP.md for the
 * full allowlist rationale.
 */

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

export function buildContentSecurityPolicy(options: CspOptions): string {
  const { apiHost, isProd, extraConnectSrc = [] } = options;

  const connectSrc = [
    "'self'",
    `https://${apiHost}`,
    ...STELLAR_HOSTS,
    ...WALLET_EXTENSION_ORIGINS,
    ...extraConnectSrc,
  ].join(' ');

  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self'${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
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

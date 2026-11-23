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
  /**
   * Whether the WalletConnect feature flag is enabled. When (and only when)
   * this is exactly `true`, the specific WalletConnect relay origins are
   * added to connect-src. This is independent of `isProd` — WalletConnect
   * can be enabled in production — and never introduces a wildcard.
   */
  walletConnectEnabled?: boolean;
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

// WalletConnect relay/verify hosts. Explicit origins only — never a
// wildcard — added to connect-src only when the WalletConnect feature flag
// is enabled. See docs/CSP.md and docs/WALLET_SETUP.md.
const WALLETCONNECT_RELAY_HOSTS = [
  'wss://relay.walletconnect.com',
  'wss://relay.walletconnect.org',
  'https://verify.walletconnect.com',
];

export function buildContentSecurityPolicy(options: CspOptions): string {
  const { apiHost, isProd, extraConnectSrc = [], walletConnectEnabled } = options;

  const connectSrc = [
    "'self'",
    `https://${apiHost}`,
    ...STELLAR_HOSTS,
    ...WALLET_EXTENSION_ORIGINS,
    // Only add these when the flag is exactly true; off (or anything else)
    // never widens the policy.
    ...(walletConnectEnabled === true ? WALLETCONNECT_RELAY_HOSTS : []),
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

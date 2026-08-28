/**
 * Content-Security-Policy `connect-src` host resolution.
 *
 * Wallet extensions (Freighter et al.) and in-app Soroban/Horizon calls need
 * `connect-src` to allow the API origin plus every Stellar RPC host actually
 * in use. Previously the Soroban RPC / Horizon host list in `next.config.ts`
 * was a hardcoded set of well-known hosts and did not take
 * `NEXT_PUBLIC_SOROBAN_RPC_URL` / `NEXT_PUBLIC_HORIZON_URL` into account, so
 * pointing the app at a non-default RPC (a private endpoint, a different
 * testnet provider, etc.) silently broke wallet calls once CSP started
 * blocking the un-listed host.
 *
 * See `docs/CSP.md` for the list of hosts this allows and how to update it
 * safely when Stellar/Soroban infrastructure changes.
 */

export type EnvSource = Record<string, string | undefined>;

/**
 * Well-known Stellar/Soroban hosts that must always be reachable regardless
 * of which network the app is configured for. Keep this in sync with
 * `NETWORK_DEFAULTS` in `contract-config.ts`.
 */
export const DEFAULT_STELLAR_CONNECT_HOSTS = [
  '*.stellar.org',
  'mainnet.sorobanrpc.com',
  'rpc-futurenet.stellar.org',
  'soroban-testnet.stellar.org',
  'horizon-testnet.stellar.org',
  'horizon-futurenet.stellar.org',
];

/** Extract a `host` or `host:port` suitable for a CSP source list from a URL string. */
export function extractHost(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return null;
  }
}

/**
 * Build the deduped list of hosts that belong in `connect-src`: the API
 * origin, the default Stellar hosts, and whatever hosts are actually
 * configured via `NEXT_PUBLIC_SOROBAN_RPC_URL` / `NEXT_PUBLIC_HORIZON_URL`.
 */
export function buildConnectSrcHosts(
  apiHost: string,
  env: EnvSource = process.env,
): string[] {
  const configuredHosts = [
    extractHost(env.NEXT_PUBLIC_SOROBAN_RPC_URL),
    extractHost(env.NEXT_PUBLIC_HORIZON_URL),
  ].filter((host): host is string => !!host);

  return Array.from(
    new Set([apiHost, ...DEFAULT_STELLAR_CONNECT_HOSTS, ...configuredHosts]),
  );
}

export interface BuildCspOptions {
  /** Host (and optional port) of the app's own API origin. */
  apiHost: string;
  /** Whether to build the stricter production policy. */
  isProd: boolean;
  /**
   * Whether to add `localhost:*` / `127.0.0.1:*` to `connect-src`.
   *
   * Defaults to `!isProd`. Deployed non-production environments (preview /
   * staging) run a production build (`isProd === true`) so they already get
   * the strict policy; pass `false` explicitly for any non-prod *build* that
   * is nonetheless a shared deployment, so a preview URL never ships a
   * policy that trusts `localhost`.
   */
  allowLocalhost?: boolean;
  env?: EnvSource;
}

/**
 * Resolve whether `localhost` sources belong in the policy.
 *
 * `localhost` is a dev-only convenience. It is dropped for a production
 * build, and also for any environment that identifies itself as a shared
 * deployment via `NEXT_PUBLIC_APP_ENV` / `VERCEL_ENV`
 * (`preview` / `staging` / `production`), even if that build was
 * accidentally made with `NODE_ENV !== 'production'`.
 */
export function shouldAllowLocalhost(
  isProd: boolean,
  env: EnvSource = process.env,
): boolean {
  if (isProd) return false;
  const appEnv = (env.NEXT_PUBLIC_APP_ENV ?? env.VERCEL_ENV ?? '')
    .toString()
    .trim()
    .toLowerCase();
  if (['preview', 'staging', 'production'].includes(appEnv)) return false;
  return true;
}

/**
 * Build the full `Content-Security-Policy` header value used by
 * `next.config.ts`. Kept separate from `next.config.ts` so it can be
 * unit-tested directly without booting Next.js.
 */
export function buildContentSecurityPolicy({
  apiHost,
  isProd,
  allowLocalhost,
  env = process.env,
}: BuildCspOptions): string {
  const connectHosts = buildConnectSrcHosts(apiHost, env);
  const localhostAllowed =
    allowLocalhost ?? shouldAllowLocalhost(isProd, env);

  const connectSrc = [
    "'self'",
    ...connectHosts,
    // Add localhost for local dev only (never on a deployed preview/staging).
    localhostAllowed && 'localhost:*',
    localhostAllowed && '127.0.0.1:*',
  ]
    .filter(Boolean)
    .join(' ');

  const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-inline' 'unsafe-eval'";

  const directives: Record<string, string[] | null> = {
    'default-src': ["'self'"],
    'script-src': [scriptSrc],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [connectSrc],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': isProd ? [] : null,
  };

  return Object.entries(directives)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => {
      if (Array.isArray(value) && value.length === 0) return key;
      return `${key} ${Array.isArray(value) ? value.join(' ') : value}`;
    })
    .join('; ');
}

/**
 * WalletConnect Sign Client integration.
 *
 * Gated behind a feature flag that defaults to OFF. When the flag is off no
 * WalletConnect code paths are executed and the UI should render a
 * "Coming soon" state. When the flag is on a project id MUST be configured,
 * otherwise a clear error is thrown before any Sign Client is created.
 *
 * See frontend/docs/WALLET_SETUP.md for enable steps and
 * frontend/docs/CSP.md for the required connect-src relay allowlist.
 */

import type { SignClient } from "@walletconnect/sign-client";

/** Feature flag key. Defaults to off unless explicitly set to "true". */
export const WALLETCONNECT_ENABLED_FLAG = "VITE_ENABLE_WALLETCONNECT";

/** Project id env var required when the flag is enabled. */
export const WALLETCONNECT_PROJECT_ID_ENV = "VITE_WALLETCONNECT_PROJECT_ID";

/** Stellar namespace used for WalletConnect sessions. */
export const STELLAR_NAMESPACE = "stellar";

/** Human readable label shown when the feature is disabled. */
export const WALLETCONNECT_COMING_SOON_LABEL = "Coming soon";

export interface WalletConnectConfig {
  enabled: boolean;
  projectId: string | null;
}

/**
 * Resolve the WalletConnect configuration from the environment.
 *
 * The flag is treated as off unless it is exactly "true", so a missing or
 * malformed value never enables WalletConnect by accident.
 */
export function getWalletConnectConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<
    string,
    string | undefined
  >,
): WalletConnectConfig {
  const enabled = env[WALLETCONNECT_ENABLED_FLAG] === "true";
  const projectId = env[WALLETCONNECT_PROJECT_ID_ENV]?.trim() || null;
  return { enabled, projectId };
}

/** True when WalletConnect is enabled via the feature flag. */
export function isWalletConnectEnabled(
  env?: Record<string, string | undefined>,
): boolean {
  return getWalletConnectConfig(env).enabled;
}

/**
 * Whether the wallet setup UI should show the "Coming soon" fallback.
 * This is the inverse of the feature flag.
 */
export function isWalletConnectComingSoon(
  env?: Record<string, string | undefined>,
): boolean {
  return !isWalletConnectEnabled(env);
}

/**
 * Error thrown when WalletConnect is enabled but not fully configured.
 * Kept explicit so callers can surface a clear message to the user.
 */
export class WalletConnectConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletConnectConfigError";
  }
}

/**
 * Assert that WalletConnect is enabled and configured. Throws a clear error
 * when the flag is on but the project id is missing. Returns the project id.
 */
export function requireWalletConnectProjectId(
  env?: Record<string, string | undefined>,
): string {
  const { enabled, projectId } = getWalletConnectConfig(env);
  if (!enabled) {
    throw new WalletConnectConfigError(
      "WalletConnect is disabled. Set " +
        WALLETCONNECT_ENABLED_FLAG +
        '="true" to enable it.',
    );
  }
  if (!projectId) {
    throw new WalletConnectConfigError(
      "WalletConnect is enabled but " +
        WALLETCONNECT_PROJECT_ID_ENV +
        " is not set. Configure a WalletConnect project id before enabling the feature.",
    );
  }
  return projectId;
}

let signClientPromise: Promise<SignClient> | null = null;

/**
 * Lazily create (and cache) the WalletConnect Sign Client.
 *
 * When the feature flag is off this resolves to null and no WalletConnect
 * module is imported, guaranteeing no WC calls happen while disabled.
 */
export async function getSignClient(
  env?: Record<string, string | undefined>,
): Promise<SignClient | null> {
  if (!isWalletConnectEnabled(env)) {
    return null;
  }
  const projectId = requireWalletConnectProjectId(env);
  if (!signClientPromise) {
    signClientPromise = import("@walletconnect/sign-client").then(
      ({ SignClient: SignClientCtor }) =>
        SignClientCtor.init({
          projectId,
          metadata: {
            name: "Stellar Wallet Setup",
            description: "Connect a WalletConnect-compatible wallet",
            url: typeof window !== "undefined" ? window.location.origin : "",
            icons: [],
          },
        }),
    );
  }
  return signClientPromise;
}

/**
 * Connect a WalletConnect session for the Stellar namespace.
 * Returns null when the feature is disabled (no WC calls are made).
 */
export async function connectWalletConnect(
  env?: Record<string, string | undefined>,
): Promise<{ uri?: string; topic: string } | null> {
  const client = await getSignClient(env);
  if (!client) {
    return null;
  }
  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      [STELLAR_NAMESPACE]: {
        methods: ["stellar_signXDR", "stellar_signAndSubmitXDR"],
        chains: ["stellar:pubnet", "stellar:testnet"],
        events: [],
      },
    },
  });
  const session = await approval();
  return { uri, topic: session.topic };
}

/**
 * Sign an XDR payload over an existing WalletConnect session.
 * Returns null when the feature is disabled (no WC calls are made).
 */
export async function signWithWalletConnect(
  topic: string,
  xdr: string,
  env?: Record<string, string | undefined>,
): Promise<string | null> {
  const client = await getSignClient(env);
  if (!client) {
    return null;
  }
  const chainId = "stellar:testnet";
  const result = await client.request<{ signedXDR: string }>({
    topic,
    chainId,
    request: { method: "stellar_signXDR", params: { xdr } },
  });
  return result.signedXDR;
}

/**
 * Disconnect an existing WalletConnect session. No-op when disabled.
 */
export async function disconnectWalletConnect(
  topic: string,
  env?: Record<string, string | undefined>,
): Promise<void> {
  const client = await getSignClient(env);
  if (!client) {
    return;
  }
  await client.disconnect({
    topic,
    reason: { code: 6000, message: "User disconnected" },
  });
}

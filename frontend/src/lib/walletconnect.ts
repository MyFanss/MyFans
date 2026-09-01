/**
 * WalletConnect Sign Client integration for Stellar.
 *
 * Loaded lazily (dynamic import) so `@walletconnect/sign-client` is only
 * pulled into the bundle when a fan actually connects with WalletConnect —
 * and only when the `walletConnect` feature flag is on
 * ({@link isWalletConnectEnabled}). Freighter/Lobstr flows never touch this
 * module.
 *
 * Docs: WALLET_SETUP.md
 */
import { createAppError } from '@/types/errors';

/** Env var holding the WalletConnect Cloud project ID. */
export const WALLET_CONNECT_PROJECT_ID_ENV = 'NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID';

/**
 * Dispatched on `window` with `{ detail: { uri } }` while a connection is
 * pending, so UI can render a QR code / deep link. Also dispatched with
 * `uri: null` once the connection resolves or fails.
 */
export const WALLET_CONNECT_URI_EVENT = 'wallet:walletconnect:uri';

/** Stellar WalletConnect JSON-RPC methods. */
const STELLAR_METHODS = ['stellar_signXDR', 'stellar_signAndSubmitXDR'] as const;

/** Minimal structural types — avoids depending on @walletconnect/types. */
interface WalletConnectSession {
  topic: string;
  namespaces: Record<string, { accounts?: string[] } | undefined>;
}

interface WalletConnectSignClient {
  connect(args: unknown): Promise<{
    uri?: string;
    approval: () => Promise<WalletConnectSession>;
  }>;
  request<T>(args: {
    topic: string;
    chainId: string;
    request: { method: string; params: unknown };
  }): Promise<T>;
  disconnect(args: { topic: string; reason: { code: number; message: string } }): Promise<void>;
  session: {
    getAll(): WalletConnectSession[];
  };
}

let clientPromise: Promise<WalletConnectSignClient> | null = null;
let activeSession: WalletConnectSession | null = null;

/** The configured project ID, or `undefined` when unset. */
export function getWalletConnectProjectId(): string | undefined {
  return process.env[WALLET_CONNECT_PROJECT_ID_ENV]?.trim() || undefined;
}

/** Whether WalletConnect has everything it needs to initialise. */
export function isWalletConnectConfigured(): boolean {
  return !!getWalletConnectProjectId();
}

function requireProjectId(): string {
  const projectId = getWalletConnectProjectId();
  if (!projectId) {
    throw createAppError('WALLET_CONNECT_CONFIG_MISSING', {
      message: 'WalletConnect project ID is not configured',
      description: `Set ${WALLET_CONNECT_PROJECT_ID_ENV} to your WalletConnect Cloud project ID.`,
    });
  }
  return projectId;
}

/** Map an app network name to a Stellar CAIP-2 chain id. */
export function stellarChainId(network?: string): string {
  const normalized = (network ?? '').trim().toLowerCase();
  return normalized === 'mainnet' || normalized === 'public'
    ? 'stellar:pubnet'
    : 'stellar:testnet';
}

function emitUri(uri: string | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WALLET_CONNECT_URI_EVENT, { detail: { uri } }));
}

/**
 * Test seam: inject a pre-built SignClient (e.g. a mocked provider) so the
 * connect/sign/disconnect branches can be unit-tested without the real SDK.
 */
export function __setWalletConnectClientForTests(
  client: WalletConnectSignClient | null,
): void {
  clientPromise = client ? Promise.resolve(client) : null;
  activeSession = null;
}

async function getClient(): Promise<WalletConnectSignClient> {
  if (!clientPromise) {
    const projectId = requireProjectId();
    clientPromise = import('@walletconnect/sign-client')
      .then(({ SignClient }) =>
        SignClient.init({
          projectId,
          metadata: {
            name: 'MyFans',
            description: 'MyFans content subscription platform',
            url:
              typeof window !== 'undefined'
                ? window.location.origin
                : 'https://myfans.app',
            icons: ['https://myfans.app/icon-512.png'],
          },
        }),
      )
      .then((client) => client as unknown as WalletConnectSignClient)
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

function accountAddress(session: WalletConnectSession): string {
  const account = session.namespaces.stellar?.accounts?.[0];
  // Accounts are CAIP-10 strings: `stellar:testnet:G...`
  const address = account?.split(':')[2];
  if (!address) {
    throw createAppError('WALLET_CONNECTION_FAILED', {
      message: 'WalletConnect session returned no Stellar account',
      description: 'Approve the Stellar account in your wallet and try again.',
    });
  }
  return address;
}

/**
 * Open a WalletConnect session. Emits {@link WALLET_CONNECT_URI_EVENT} with the
 * pairing URI so the UI can show a QR code, then resolves with the connected
 * Stellar address once the wallet approves.
 */
export async function connectWalletConnect(network?: string): Promise<string> {
  const client = await getClient();
  const chainId = stellarChainId(network);

  try {
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        stellar: {
          chains: [chainId],
          methods: [...STELLAR_METHODS],
          events: [],
        },
      },
    });

    if (uri) emitUri(uri);

    const session = await approval();
    activeSession = session;
    return accountAddress(session);
  } finally {
    emitUri(null);
  }
}

function resolveSession(client: WalletConnectSignClient): WalletConnectSession {
  if (activeSession) return activeSession;

  const existing = client.session.getAll();
  const stellarSession = existing.find((s) => s.namespaces.stellar);
  if (stellarSession) {
    activeSession = stellarSession;
    return stellarSession;
  }

  throw createAppError('WALLET_NOT_CONNECTED', {
    message: 'No active WalletConnect session',
    description: 'Connect your wallet with WalletConnect before signing.',
  });
}

/**
 * Sign an XDR with the active WalletConnect session.
 * Called by `signTransaction()` in `@/lib/wallet` for the `walletconnect` branch.
 */
export async function signWithWalletConnectClient(
  xdr: string,
  opts?: { network?: string; networkPassphrase?: string },
): Promise<string> {
  const client = await getClient();
  const session = resolveSession(client);
  const chainId = stellarChainId(opts?.network);

  const result = await client.request<{ signedXDR?: string } | string>({
    topic: session.topic,
    chainId,
    request: {
      method: 'stellar_signXDR',
      params: { xdr },
    },
  });

  const signedXdr = typeof result === 'string' ? result : result?.signedXDR;
  if (!signedXdr) {
    throw createAppError('WALLET_SIGNATURE_FAILED', {
      message: 'WalletConnect returned no signed transaction',
    });
  }
  return signedXdr;
}

/** Address of the current WalletConnect session, if any. */
export async function getWalletConnectAddress(): Promise<string | null> {
  if (!isWalletConnectConfigured()) return null;
  try {
    const client = await getClient();
    const session = resolveSession(client);
    return accountAddress(session);
  } catch {
    return null;
  }
}

/** Tear down the active WalletConnect session. */
export async function disconnectWalletConnect(): Promise<void> {
  try {
    if (clientPromise && activeSession) {
      const client = await clientPromise;
      await client.disconnect({
        topic: activeSession.topic,
        reason: { code: 6000, message: 'User disconnected' },
      });
    }
  } catch {
    // Best-effort — always clear local state below.
  } finally {
    activeSession = null;
  }
}

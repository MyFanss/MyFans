import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  connectWalletConnect,
  disconnectWalletConnect,
  getWalletConnectProjectId,
  isWalletConnectConfigured,
  signWithWalletConnectClient,
  stellarChainId,
  __setWalletConnectClientForTests,
  WALLET_CONNECT_URI_EVENT,
} from '../walletconnect';

const FAN_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

/** Minimal mocked WalletConnect SignClient. */
function mockClient(overrides: Partial<Record<string, unknown>> = {}) {
  const session = {
    topic: 'topic-1',
    namespaces: {
      stellar: { accounts: [`stellar:testnet:${FAN_ADDRESS}`] },
    },
  };
  return {
    connect: vi.fn(async () => ({
      uri: 'wc:deadbeef@2?relay-protocol=irn',
      approval: vi.fn(async () => session),
    })),
    request: vi.fn(async () => ({ signedXDR: 'SIGNED_XDR' })),
    disconnect: vi.fn(async () => undefined),
    session: { getAll: vi.fn(() => [session]) },
    ...overrides,
  };
}

describe('walletconnect module', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
    __setWalletConnectClientForTests(null);
  });

  afterEach(() => {
    __setWalletConnectClientForTests(null);
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('reports missing project id', () => {
      expect(getWalletConnectProjectId()).toBeUndefined();
      expect(isWalletConnectConfigured()).toBe(false);
    });

    it('reads the project id from env', () => {
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'proj-123';
      expect(getWalletConnectProjectId()).toBe('proj-123');
      expect(isWalletConnectConfigured()).toBe(true);
    });

    it('connect throws a structured error when project id is missing', async () => {
      await expect(connectWalletConnect()).rejects.toMatchObject({
        code: 'WALLET_CONNECT_CONFIG_MISSING',
      });
    });
  });

  describe('stellarChainId', () => {
    it('maps public/mainnet to stellar:pubnet and everything else to testnet', () => {
      expect(stellarChainId('mainnet')).toBe('stellar:pubnet');
      expect(stellarChainId('public')).toBe('stellar:pubnet');
      expect(stellarChainId('testnet')).toBe('stellar:testnet');
      expect(stellarChainId(undefined)).toBe('stellar:testnet');
    });
  });

  describe('connect (mocked provider)', () => {
    it('emits the pairing URI and resolves with the Stellar address', async () => {
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'proj-123';
      const client = mockClient();
      __setWalletConnectClientForTests(client as never);

      const uris: (string | null)[] = [];
      const handler = (e: Event) =>
        uris.push((e as CustomEvent<{ uri: string | null }>).detail?.uri ?? null);
      window.addEventListener(WALLET_CONNECT_URI_EVENT, handler);

      const address = await connectWalletConnect('testnet');
      window.removeEventListener(WALLET_CONNECT_URI_EVENT, handler);

      expect(address).toBe(FAN_ADDRESS);
      expect(client.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredNamespaces: expect.objectContaining({
            stellar: expect.objectContaining({ chains: ['stellar:testnet'] }),
          }),
        }),
      );
      // URI shown while pending, then cleared.
      expect(uris).toEqual(['wc:deadbeef@2?relay-protocol=irn', null]);
    });
  });

  describe('sign (mocked provider)', () => {
    it('requests stellar_signXDR and returns the signed XDR', async () => {
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'proj-123';
      const client = mockClient();
      __setWalletConnectClientForTests(client as never);

      const signed = await signWithWalletConnectClient('RAW_XDR', { network: 'testnet' });

      expect(signed).toBe('SIGNED_XDR');
      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'topic-1',
          chainId: 'stellar:testnet',
          request: { method: 'stellar_signXDR', params: { xdr: 'RAW_XDR' } },
        }),
      );
    });

    it('throws when the wallet returns no signature', async () => {
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'proj-123';
      const client = mockClient({ request: vi.fn(async () => ({})) });
      __setWalletConnectClientForTests(client as never);

      await expect(
        signWithWalletConnectClient('RAW_XDR', { network: 'testnet' }),
      ).rejects.toMatchObject({ code: 'WALLET_SIGNATURE_FAILED' });
    });

    it('throws WALLET_NOT_CONNECTED when there is no session', async () => {
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'proj-123';
      const client = mockClient({ session: { getAll: vi.fn(() => []) } });
      __setWalletConnectClientForTests(client as never);

      await expect(
        signWithWalletConnectClient('RAW_XDR', { network: 'testnet' }),
      ).rejects.toMatchObject({ code: 'WALLET_NOT_CONNECTED' });
    });
  });

  describe('disconnect (mocked provider)', () => {
    it('tears down the active session', async () => {
      process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID = 'proj-123';
      const client = mockClient();
      __setWalletConnectClientForTests(client as never);

      await connectWalletConnect('testnet');
      await disconnectWalletConnect();

      expect(client.disconnect).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'topic-1' }),
      );
    });
  });
});

/**
 * Tests for SubscriptionEventPollerService:
 *  - feature flag disables polling
 *  - stale / disconnected RPC is handled gracefully (no throw)
 *  - typed methods are called (no any-cast)
 *  - fail-fast on enabled-but-missing-RPC in production
 */
import { SubscriptionEventPollerService } from './subscription-event-poller.service';
import { RequestContextService } from '../../common/services/request-context.service';

function makePoller(overrides: {
  pollerEnabled?: boolean;
  getLatestLedgerSequence?: () => Promise<number>;
  getNetworkEvents?: () => Promise<any>;
  checkpoint?: number;
  nodeEnv?: string;
  rpcUrl?: string;
}) {
  const requestContext = new RequestContextService();

  const featureFlags = {
    isSorobanPollerEnabled: jest.fn().mockReturnValue(overrides.pollerEnabled ?? true),
    logPollerFlagResolution: jest.fn(),
  };

  const indexRepo = {
    getLatestCheckpoint: jest.fn().mockResolvedValue(overrides.checkpoint ?? 0),
    findByEventId: jest.fn().mockResolvedValue(null),
    upsertEvent: jest.fn().mockResolvedValue({ id: '1', eventType: 'subscribed', fan: 'A', creator: 'B', planId: 0, expiryUnix: 9999999999 }),
  };

  const sorobanRpc = {
    getLatestLedgerSequence: jest.fn().mockImplementation(
      overrides.getLatestLedgerSequence ?? (() => Promise.resolve(0)),
    ),
    getNetworkEvents: jest.fn().mockImplementation(
      overrides.getNetworkEvents ?? (() => Promise.resolve({ events: [], startLedger: 0, latestLedger: 0 })),
    ),
  };

  const eventBus = { publish: jest.fn() };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return overrides.nodeEnv ?? 'test';
      if (key === 'SOROBAN_RPC_URL') return overrides.rpcUrl;
      return 'CONTRACT_ID';
    }),
  };

  const svc = new (SubscriptionEventPollerService as any)(
    configService,
    indexRepo,
    eventBus,
    sorobanRpc,
    requestContext,
    featureFlags,
  ) as SubscriptionEventPollerService;

  (svc as any).contractId = 'CONTRACT_ID';

  return { svc, sorobanRpc, indexRepo, featureFlags, eventBus, configService };
}

describe('SubscriptionEventPollerService – feature flag', () => {
  it('skips poll when isSorobanPollerEnabled returns false', async () => {
    const { svc, sorobanRpc } = makePoller({ pollerEnabled: false });
    await svc.poll();
    expect(sorobanRpc.getLatestLedgerSequence).not.toHaveBeenCalled();
  });

  it('proceeds when isSorobanPollerEnabled returns true', async () => {
    const { svc, sorobanRpc } = makePoller({ pollerEnabled: true, checkpoint: 5 });
    // latest == checkpoint → early return, but RPC was still called
    sorobanRpc.getLatestLedgerSequence.mockResolvedValue(5);
    await svc.poll();
    expect(sorobanRpc.getLatestLedgerSequence).toHaveBeenCalledTimes(1);
  });

  it('logs flag resolution on init', async () => {
    const { svc, featureFlags } = makePoller({ pollerEnabled: true });
    await (svc as any).onModuleInit?.();
    expect(featureFlags.logPollerFlagResolution).toHaveBeenCalled();
  });

  it('fails fast when enabled in production but RPC is missing', async () => {
    const { svc } = makePoller({
      pollerEnabled: true,
      nodeEnv: 'production',
      rpcUrl: undefined,
    });

    await expect((svc as any).onModuleInit?.()).rejects.toThrow(
      /Soroban poller is enabled in production but SOROBAN_RPC_URL is not configured/,
    );
  });

  it('starts normally when enabled in production with RPC configured', async () => {
    const { svc } = makePoller({
      pollerEnabled: true,
      nodeEnv: 'production',
      rpcUrl: 'https://soroban-testnet.stellar.org',
    });

    await expect((svc as any).onModuleInit?.()).resolves.toBeUndefined();
  });
});

describe('SubscriptionEventPollerService – stale / disconnected RPC', () => {
  it('does not throw when getLatestLedgerSequence rejects', async () => {
    const { svc, sorobanRpc } = makePoller({
      pollerEnabled: true,
      getLatestLedgerSequence: () => Promise.reject(new Error('connection refused')),
    });
    await expect(svc.poll()).resolves.toBeUndefined();
    expect(sorobanRpc.getNetworkEvents).not.toHaveBeenCalled();
  });

  it('does not throw when getNetworkEvents rejects mid-page', async () => {
    const { svc, sorobanRpc } = makePoller({
      pollerEnabled: true,
      getLatestLedgerSequence: () => Promise.resolve(100),
      getNetworkEvents: () => Promise.reject(new Error('rpc timeout')),
      checkpoint: 50,
    });
    await expect(svc.poll()).resolves.toBeUndefined();
  });

  it('uses typed getLatestLedgerSequence (not any-cast)', async () => {
    const { svc, sorobanRpc } = makePoller({ pollerEnabled: true, checkpoint: 10 });
    sorobanRpc.getLatestLedgerSequence.mockResolvedValue(10); // no new ledgers
    await svc.poll();
    // Verify the real method was called, not a dynamic property
    expect(sorobanRpc.getLatestLedgerSequence).toHaveBeenCalledTimes(1);
  });
});

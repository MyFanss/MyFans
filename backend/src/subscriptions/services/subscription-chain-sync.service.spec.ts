import { Logger } from '@nestjs/common';
import { SubscriptionChainSyncService } from './subscription-chain-sync.service';
import { SubscriptionIndexRepository } from '../repositories/subscription-index.repository';
import { SubscriptionChainReaderService } from '../subscription-chain-reader.service';
import { SubscriptionIndexEntity, SubscriptionStatus } from '../entities/subscription-index.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const FAN = 'GFAN1111111111111111111111111111111111111111111111111111';
const CREATOR = 'GCREATOR111111111111111111111111111111111111111111111111';

const nowSecs = () => Math.floor(Date.now() / 1000);

function makeSub(
  overrides: Partial<SubscriptionIndexEntity> = {},
): SubscriptionIndexEntity {
  return {
    id: 'sub-1',
    fan: FAN,
    creator: CREATOR,
    planId: 1,
    expiryUnix: nowSecs() + 30 * 24 * 3600, // active by default
    status: SubscriptionStatus.ACTIVE,
    ledgerSeq: 100,
    eventIndex: 0,
    txHash: undefined,
    eventType: 'manual',
    createdAt: new Date(),
    indexedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SubscriptionIndexEntity;
}

function makeRepo(subs: SubscriptionIndexEntity[] = []): jest.Mocked<SubscriptionIndexRepository> {
  return {
    findAllForReconciler: jest.fn().mockResolvedValue(subs),
    listActiveForFan: jest.fn().mockResolvedValue(subs),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    upsertManual: jest.fn().mockImplementation(async (data) => ({
      ...makeSub(),
      ...data,
    })),
  } as unknown as jest.Mocked<SubscriptionIndexRepository>;
}

function makeChainReader(
  contractId: string | undefined,
  isSubscriberResult: { ok: boolean; isSubscriber?: boolean; error?: string },
  expiryResult?: { ok: boolean; expiryUnix?: number; expiryLedgerSeq?: number; skewMs?: number; error?: string },
): jest.Mocked<SubscriptionChainReaderService> {
  return {
    getConfiguredContractId: jest.fn().mockReturnValue(contractId),
    readIsSubscriber: jest.fn().mockResolvedValue(isSubscriberResult),
    readExpiryUnix: jest.fn().mockResolvedValue(
      expiryResult ?? { ok: false, error: 'not called' },
    ),
  } as unknown as jest.Mocked<SubscriptionChainReaderService>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubscriptionChainSyncService', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('when no contract ID is configured', () => {
    it('returns an empty result without touching the repo', async () => {
      const repo = makeRepo([makeSub()]);
      const chainReader = makeChainReader(undefined, { ok: true, isSubscriber: true });
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.contractId).toBeNull();
      expect(result.totalScanned).toBe(0);
      expect(result.records).toHaveLength(0);
      expect(repo.findAllForReconciler).not.toHaveBeenCalled();
    });

    it('returns an empty result when chainReader is not injected', async () => {
      const repo = makeRepo([makeSub()]);
      const svc = new SubscriptionChainSyncService(repo);

      const result = await svc.sync();

      expect(result.totalScanned).toBe(0);
      expect(result.contractId).toBeNull();
    });
  });

  describe('when chain says subscriber is active', () => {
    it('takes no action for a locally-active subscription', async () => {
      const sub = makeSub({ status: SubscriptionStatus.ACTIVE });
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: true },
        { ok: true, expiryUnix: nowSecs() + 3600, expiryLedgerSeq: 200, skewMs: 0 },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('none');
      expect(result.records[0].applied).toBe(false);
      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(repo.upsertManual).not.toHaveBeenCalled();
    });

    it('re-activates a locally-expired subscription', async () => {
      const sub = makeSub({
        status: SubscriptionStatus.EXPIRED,
        expiryUnix: nowSecs() - 3600, // expired 1 hour ago
      });
      const repo = makeRepo([sub]);
      const chainExpiry = nowSecs() + 7 * 24 * 3600;
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: true },
        { ok: true, expiryUnix: chainExpiry, expiryLedgerSeq: 200, skewMs: 0 },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('activate');
      expect(result.records[0].applied).toBe(true);
      expect(result.activated).toBe(1);
      expect(repo.upsertManual).toHaveBeenCalledWith(
        expect.objectContaining({
          fan: FAN,
          creator: CREATOR,
          status: SubscriptionStatus.ACTIVE,
          expiryUnix: chainExpiry,
        }),
      );
    });

    it('re-activates using a fallback expiry when chain expiry read fails', async () => {
      const sub = makeSub({
        status: SubscriptionStatus.EXPIRED,
        expiryUnix: nowSecs() - 3600,
      });
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: true },
        { ok: false, error: 'expiry read failed' },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('activate');
      expect(result.records[0].applied).toBe(true);
      // Fallback expiry should be approximately now + 30 days
      const upsertCall = (repo.upsertManual as jest.Mock).mock.calls[0][0];
      const expectedMin = nowSecs() + 29 * 24 * 3600;
      const expectedMax = nowSecs() + 31 * 24 * 3600;
      expect(upsertCall.expiryUnix).toBeGreaterThanOrEqual(expectedMin);
      expect(upsertCall.expiryUnix).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('when chain says subscriber is not active', () => {
    it('expires a locally-active subscription', async () => {
      const sub = makeSub({ status: SubscriptionStatus.ACTIVE });
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: false },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('expire');
      expect(result.records[0].applied).toBe(true);
      expect(result.expired).toBe(1);
      expect(repo.updateStatus).toHaveBeenCalledWith(
        FAN,
        CREATOR,
        SubscriptionStatus.EXPIRED,
      );
    });

    it('takes no action for a locally-expired subscription', async () => {
      const sub = makeSub({
        status: SubscriptionStatus.EXPIRED,
        expiryUnix: nowSecs() - 3600,
      });
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: false },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('none');
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('cancelled subscriptions', () => {
    it('skips cancelled subscriptions without a chain read', async () => {
      const sub = makeSub({ status: SubscriptionStatus.CANCELLED });
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: true },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('skipped');
      expect(chainReader.readIsSubscriber).not.toHaveBeenCalled();
    });
  });

  describe('chain read failures', () => {
    it('marks record as skipped when is_subscriber read fails', async () => {
      const sub = makeSub();
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: false, error: 'RPC timeout' },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.records[0].action).toBe('skipped');
      expect(result.records[0].chainError).toBe('RPC timeout');
      expect(result.skipped).toBe(1);
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('continues processing remaining subscriptions after a chain error', async () => {
      const sub1 = makeSub({ id: 'sub-1', fan: FAN });
      const sub2 = makeSub({ id: 'sub-2', fan: 'GFAN2222222222222222222222222222222222222222222222222222' });
      const repo = makeRepo([sub1, sub2]);

      const chainReader = {
        getConfiguredContractId: jest.fn().mockReturnValue(CONTRACT_ID),
        readIsSubscriber: jest
          .fn()
          .mockResolvedValueOnce({ ok: false, error: 'timeout' })
          .mockResolvedValueOnce({ ok: true, isSubscriber: true }),
        readExpiryUnix: jest.fn().mockResolvedValue({ ok: false, error: 'not called' }),
      } as unknown as jest.Mocked<SubscriptionChainReaderService>;

      const svc = new SubscriptionChainSyncService(repo, chainReader);
      const result = await svc.sync();

      expect(result.totalScanned).toBe(2);
      expect(result.records[0].action).toBe('skipped');
      expect(result.records[1].action).toBe('none');
    });

    it('marks record as skipped and increments errors on unexpected exception', async () => {
      const sub = makeSub();
      const repo = makeRepo([sub]);
      const chainReader = {
        getConfiguredContractId: jest.fn().mockReturnValue(CONTRACT_ID),
        readIsSubscriber: jest.fn().mockRejectedValue(new Error('unexpected crash')),
        readExpiryUnix: jest.fn(),
      } as unknown as jest.Mocked<SubscriptionChainReaderService>;

      const svc = new SubscriptionChainSyncService(repo, chainReader);
      const result = await svc.sync();

      expect(result.records[0].action).toBe('skipped');
      expect(result.records[0].error).toBe('unexpected crash');
      expect(result.errors).toBe(1);
    });
  });

  describe('dry-run mode', () => {
    it('evaluates actions but does not write to the repo', async () => {
      const sub = makeSub({ status: SubscriptionStatus.ACTIVE });
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: false },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync(true /* dryRun */);

      expect(result.dryRun).toBe(true);
      expect(result.records[0].action).toBe('expire');
      expect(result.records[0].applied).toBe(false);
      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(result.expired).toBe(0); // not counted when not applied
    });
  });

  describe('fan filter', () => {
    it('uses listActiveForFan when fanFilter is provided', async () => {
      const sub = makeSub();
      const repo = makeRepo([sub]);
      const chainReader = makeChainReader(
        CONTRACT_ID,
        { ok: true, isSubscriber: true },
        { ok: true, expiryUnix: nowSecs() + 3600, expiryLedgerSeq: 200, skewMs: 0 },
      );
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      await svc.sync(false, FAN);

      expect(repo.listActiveForFan).toHaveBeenCalledWith(FAN);
      expect(repo.findAllForReconciler).not.toHaveBeenCalled();
    });

    it('uses findAllForReconciler when no fanFilter is provided', async () => {
      const repo = makeRepo([]);
      const chainReader = makeChainReader(CONTRACT_ID, { ok: true, isSubscriber: true });
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      await svc.sync();

      expect(repo.findAllForReconciler).toHaveBeenCalled();
      expect(repo.listActiveForFan).not.toHaveBeenCalled();
    });
  });

  describe('result shape', () => {
    it('includes syncedAt as a valid ISO 8601 timestamp', async () => {
      const repo = makeRepo([]);
      const chainReader = makeChainReader(CONTRACT_ID, { ok: true, isSubscriber: true });
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(result.syncedAt)).not.toThrow();
    });

    it('includes the configured contractId in the result', async () => {
      const repo = makeRepo([]);
      const chainReader = makeChainReader(CONTRACT_ID, { ok: true, isSubscriber: true });
      const svc = new SubscriptionChainSyncService(repo, chainReader);

      const result = await svc.sync();

      expect(result.contractId).toBe(CONTRACT_ID);
    });
  });
});

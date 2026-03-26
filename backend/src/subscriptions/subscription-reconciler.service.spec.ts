import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionReconcilerService } from './subscription-reconciler.service';
import { SubscriptionsService } from './subscriptions.service';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { JobLoggerService } from '../common/services/job-logger.service';

const nowSecs = () => Math.floor(Date.now() / 1000);

function makeSub(overrides: Partial<{ id: string; fan: string; creator: string; expiry: number; status: string }> = {}) {
  return {
    id: 'sub-1',
    fan: 'GFAN',
    creator: 'GCREATOR',
    expiry: nowSecs() + 86400,
    status: 'active',
    ...overrides,
  };
}

describe('SubscriptionReconcilerService', () => {
  let service: SubscriptionReconcilerService;
  let subscriptionsMock: jest.Mocked<Pick<SubscriptionsService, 'getAllSubscriptionsInternal' | 'expireSubscription' | 'addSubscription' | 'getSubscription'>>;
  let sorobanMock: jest.Mocked<Pick<SorobanRpcService, 'checkConnectivity'>>;
  let jobLoggerMock: { start: jest.Mock };

  beforeEach(async () => {
    subscriptionsMock = {
      getAllSubscriptionsInternal: jest.fn().mockReturnValue([]),
      expireSubscription: jest.fn(),
      addSubscription: jest.fn(),
      getSubscription: jest.fn(),
    };
    sorobanMock = {
      checkConnectivity: jest.fn().mockResolvedValue({ status: 'down' }),
    };
    jobLoggerMock = {
      start: jest.fn().mockReturnValue({ done: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionReconcilerService,
        { provide: SubscriptionsService, useValue: subscriptionsMock },
        { provide: SorobanRpcService, useValue: sorobanMock },
        { provide: JobLoggerService, useValue: jobLoggerMock },
      ],
    }).compile();

    service = module.get(SubscriptionReconcilerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reconcile - no subscriptions', () => {
    it('returns zero counts when store is empty', async () => {
      const result = await service.reconcile(true);
      expect(result.totalScanned).toBe(0);
      expect(result.staleFound).toBe(0);
      expect(result.repaired).toBe(0);
    });
  });

  describe('stale criteria 1: active-past-expiry', () => {
    it('detects active subscription past expiry', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'active' }),
      ]);
      const result = await service.reconcile(true); // dry-run
      expect(result.staleFound).toBe(1);
      expect(result.records[0].staleCriteria).toBe('active-past-expiry');
      expect(result.records[0].action).toBe('expire');
    });

    it('dry-run does NOT call expireSubscription', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'active' }),
      ]);
      await service.reconcile(true);
      expect(subscriptionsMock.expireSubscription).not.toHaveBeenCalled();
    });

    it('live run calls expireSubscription', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'active' }),
      ]);
      const result = await service.reconcile(false);
      expect(subscriptionsMock.expireSubscription).toHaveBeenCalledWith('GFAN', 'GCREATOR');
      expect(result.repaired).toBe(1);
      expect(result.records[0].applied).toBe(true);
    });
  });

  describe('stale criteria 2: active-chain-expired (chain available)', () => {
    beforeEach(() => {
      sorobanMock.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
      jest.spyOn(service as any, 'queryChainExpiry').mockResolvedValue(nowSecs() - 200);
    });

    it('detects active sub that chain says is expired', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() + 86400, status: 'active' }),
      ]);
      const result = await service.reconcile(true);
      expect(result.records[0].staleCriteria).toBe('active-chain-expired');
      expect(result.records[0].action).toBe('expire');
    });
  });

  describe('stale criteria 3: expired-chain-active (chain available)', () => {
    const futureExpiry = nowSecs() + 86400;

    beforeEach(() => {
      sorobanMock.checkConnectivity.mockResolvedValue({ status: 'up', timestamp: new Date().toISOString() });
      jest.spyOn(service as any, 'queryChainExpiry').mockResolvedValue(futureExpiry);
    });

    it('detects expired sub that chain says is still active', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'expired' }),
      ]);
      const result = await service.reconcile(true);
      expect(result.records[0].staleCriteria).toBe('expired-chain-active');
      expect(result.records[0].action).toBe('activate');
    });

    it('live run calls addSubscription with chain expiry', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'expired' }),
      ]);
      subscriptionsMock.getSubscription.mockReturnValue({
        id: 'sub-1', fan: 'GFAN', creator: 'GCREATOR', planId: 1,
        expiry: nowSecs() - 100, status: 'expired', createdAt: new Date(),
      } as any);
      await service.reconcile(false);
      expect(subscriptionsMock.addSubscription).toHaveBeenCalledWith('GFAN', 'GCREATOR', 1, futureExpiry);
    });
  });

  describe('healthy subscription - no action', () => {
    it('does not flag a healthy active subscription', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() + 86400, status: 'active' }),
      ]);
      const result = await service.reconcile(true);
      expect(result.staleFound).toBe(0);
      expect(result.records[0].action).toBe('none');
    });
  });

  describe('result is auditable', () => {
    it('result includes scannedAt, dryRun flag, and per-record details', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'active' }),
      ]);
      const result = await service.reconcile(true);
      expect(result.scannedAt).toBeDefined();
      expect(result.dryRun).toBe(true);
      expect(result.records[0]).toMatchObject({
        subscriptionId: 'sub-1',
        fan: 'GFAN',
        creator: 'GCREATOR',
        staleCriteria: 'active-past-expiry',
        action: 'expire',
        applied: false,
      });
    });
  });

  describe('error handling', () => {
    it('records error per subscription without crashing the job', async () => {
      subscriptionsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub({ expiry: nowSecs() - 100, status: 'active' }),
      ]);
      subscriptionsMock.expireSubscription.mockImplementation(() => { throw new Error('DB error'); });
      const result = await service.reconcile(false);
      expect(result.errors).toBe(1);
      expect(result.records[0].error).toBe('DB error');
    });
  });
});

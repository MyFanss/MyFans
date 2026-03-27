import { Test, TestingModule } from '@nestjs/testing';
import { CreatorDashboardService } from './creator-dashboard.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreatorsService } from './creators.service';

const CREATOR = 'GCREATOR';
const FAN1 = 'GFAN1';
const FAN2 = 'GFAN2';
const nowSecs = () => Math.floor(Date.now() / 1000);

function makeSub(fan: string, planId: number, status: 'active' | 'expired', expiryOffset: number, createdDaysAgo = 5) {
  const createdAt = new Date(Date.now() - createdDaysAgo * 86400_000);
  return {
    id: `${fan}-${planId}`,
    fan,
    creator: CREATOR,
    planId,
    expiry: nowSecs() + expiryOffset,
    status,
    createdAt,
  };
}

describe('CreatorDashboardService', () => {
  let service: CreatorDashboardService;
  let subsMock: jest.Mocked<Pick<SubscriptionsService, 'getAllSubscriptionsInternal'>>;
  let creatorsMock: jest.Mocked<Pick<CreatorsService, 'getCreatorPlans'>>;

  const mockPlans = [
    { id: 1, creator: CREATOR, asset: 'XLM', amount: '10', intervalDays: 30 },
    { id: 2, creator: CREATOR, asset: 'USDC:GISSUER', amount: '5', intervalDays: 30 },
  ];

  beforeEach(async () => {
    subsMock = { getAllSubscriptionsInternal: jest.fn().mockReturnValue([]) };
    creatorsMock = { getCreatorPlans: jest.fn().mockReturnValue(mockPlans) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorDashboardService,
        { provide: SubscriptionsService, useValue: subsMock },
        { provide: CreatorsService, useValue: creatorsMock },
      ],
    }).compile();

    service = module.get(CreatorDashboardService);
    service.invalidateCache();
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('subscriber metrics', () => {
    it('counts active subscribers correctly', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400),
        makeSub(FAN2, 1, 'expired', -100),
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      expect(result.subscribers.active).toBe(1);
    });

    it('counts new subscribers in window', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400, 3),   // 3 days ago — in 30d window
        makeSub(FAN2, 1, 'active', 86400, 60),  // 60 days ago — outside 30d window
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      expect(result.subscribers.newInWindow).toBe(1);
    });

    it('counts churned in window', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'expired', -100, 5),  // expired recently, created 5d ago
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      expect(result.subscribers.churned).toBe(1);
    });
  });

  describe('revenue metrics', () => {
    it('calculates gross, fee, net correctly', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400, 5), // plan 1: 10 XLM
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      expect(result.revenue.grossTotal).toBeCloseTo(10);
      expect(result.revenue.feeTotal).toBeCloseTo(0.5);   // 5% of 10
      expect(result.revenue.netTotal).toBeCloseTo(9.5);
    });

    it('aggregates revenue by plan', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400, 5),
        makeSub(FAN2, 2, 'active', 86400, 5),
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      expect(result.revenue.byPlan).toHaveLength(2);
      const plan1 = result.revenue.byPlan.find(p => p.planId === 1)!;
      expect(plan1.asset).toBe('XLM');
      expect(plan1.subscriptionCount).toBe(1);
    });

    it('strips issuer from asset code in revenue breakdown', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 2, 'active', 86400, 5),
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      expect(result.revenue.byPlan[0].asset).toBe('USDC');
    });
  });

  describe('time-window filtering', () => {
    it('respects 7d window', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400, 3),   // 3d ago — in 7d
        makeSub(FAN2, 1, 'active', 86400, 10),  // 10d ago — outside 7d
      ]);
      const result = await service.getDashboard(CREATOR, { window: '7d' });
      expect(result.subscribers.newInWindow).toBe(1);
      expect(result.window).toBe('7d');
    });

    it('respects custom from/to dates', async () => {
      const from = new Date(Date.now() - 2 * 86400_000).toISOString();
      const to = new Date().toISOString();
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400, 1),  // 1d ago — in custom range
        makeSub(FAN2, 1, 'active', 86400, 5),  // 5d ago — outside custom range
      ]);
      const result = await service.getDashboard(CREATOR, { from, to });
      expect(result.subscribers.newInWindow).toBe(1);
      expect(result.window).toBe('custom');
    });

    it('all window includes everything', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400, 365),
        makeSub(FAN2, 1, 'active', 86400, 3),
      ]);
      const result = await service.getDashboard(CREATOR, { window: 'all' });
      expect(result.subscribers.newInWindow).toBe(2);
    });
  });

  describe('caching', () => {
    it('returns cached result on second call', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([]);
      await service.getDashboard(CREATOR, { window: '30d' });
      await service.getDashboard(CREATOR, { window: '30d' });
      expect(subsMock.getAllSubscriptionsInternal).toHaveBeenCalledTimes(1);
    });

    it('invalidateCache forces fresh aggregation', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([]);
      await service.getDashboard(CREATOR, { window: '30d' });
      service.invalidateCache(CREATOR);
      await service.getDashboard(CREATOR, { window: '30d' });
      expect(subsMock.getAllSubscriptionsInternal).toHaveBeenCalledTimes(2);
    });
  });

  describe('plans summary', () => {
    it('includes active subscriber count per plan', async () => {
      subsMock.getAllSubscriptionsInternal.mockReturnValue([
        makeSub(FAN1, 1, 'active', 86400),
        makeSub(FAN2, 1, 'active', 86400),
      ]);
      const result = await service.getDashboard(CREATOR, { window: '30d' });
      const plan1 = result.plans.find(p => p.id === 1)!;
      expect(plan1.activeSubscribers).toBe(2);
    });
  });
});

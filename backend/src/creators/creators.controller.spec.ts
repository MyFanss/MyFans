import { CreatorsController } from './creators.controller';

function mockService() {
  return {
    listCreators: jest.fn().mockResolvedValue([]),
    getCreatorPlans: jest.fn().mockResolvedValue([]),
    getCreatorAccess: jest.fn().mockResolvedValue({ hasAccess: false, subscriptionStatus: 'none', planId: null, teaser: null, contentCid: null }),
    getDashboardSummary: jest.fn().mockResolvedValue({ subscribers: 0, activeSubscriptions: 0, monthlyRevenue: 0, currency: 'USD' }),
  };
}

describe('CreatorsController', () => {
  let service: ReturnType<typeof mockService>;
  let controller: CreatorsController;
  beforeEach(() => { service = mockService(); controller = new CreatorsController(service as any); });

  describe('listCreators', () => {
    it('defaults limit to 12 for missing/non-numeric input', async () => {
      await controller.listCreators(undefined, undefined, undefined);
      expect(service.listCreators).toHaveBeenCalledWith(expect.objectContaining({ limit: 12 }));
    });
    it('clamps to 1 for 0 or negative', async () => {
      await controller.listCreators('0', undefined, undefined);
      expect(service.listCreators).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
    });
    it('clamps to 50 for values above 50', async () => {
      await controller.listCreators('999', undefined, undefined);
      expect(service.listCreators).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });
    it('passes null for 1-char or whitespace-only q', async () => {
      await controller.listCreators(undefined, undefined, 'a');
      expect(service.listCreators).toHaveBeenCalledWith(expect.objectContaining({ query: null }));
      await controller.listCreators(undefined, undefined, '   ');
      expect(service.listCreators).toHaveBeenLastCalledWith(expect.objectContaining({ query: null }));
    });
    it('trims and caps q at 100 characters', async () => {
      await controller.listCreators(undefined, undefined, `  ${'x'.repeat(150)}  `);
      expect(service.listCreators).toHaveBeenCalledWith(expect.objectContaining({ query: 'x'.repeat(100) }));
    });
  });

  describe('getCreatorAccess', () => {
    it('returns contentCid when hasAccess is true', async () => {
      service.getCreatorAccess.mockResolvedValue({ hasAccess: true, subscriptionStatus: 'active', planId: 'p1', teaser: null, contentCid: 'cid123' });
      expect((await controller.getCreatorAccess('1', {} as any)).contentCid).toBe('cid123');
    });
    it('returns null contentCid when hasAccess is false', async () => {
      service.getCreatorAccess.mockResolvedValue({ hasAccess: false, subscriptionStatus: 'none', planId: null, teaser: 't', contentCid: 'secret' });
      expect((await controller.getCreatorAccess('1', {} as any)).contentCid).toBeNull();
    });
  });

  describe('getDashboardSummary', () => {
    it('throws Forbidden on creator-id mismatch', async () => {
      await expect(controller.getDashboardSummary('1', { creator: { id: '2' } } as any, undefined)).rejects.toThrow('Forbidden');
    });
    it('throws simulated error only when NODE_ENV is test', async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      await controller.getDashboardSummary('1', { creator: { id: '1' } } as any, 'true');
      process.env.NODE_ENV = 'test';
      await expect(controller.getDashboardSummary('1', { creator: { id: '1' } } as any, 'true')).rejects.toThrow('Simulated dashboard failure');
      process.env.NODE_ENV = orig;
    });
  });
});

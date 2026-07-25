import { Test, TestingModule } from '@nestjs/testing';
import { EarningsService } from './earnings.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

describe('EarningsService', () => {
  let service: EarningsService;
  let analyticsService: jest.Mocked<Pick<AnalyticsService, 'getEarnings' | 'getPayments'>>;

  beforeEach(async () => {
    analyticsService = {
      getEarnings: jest.fn(),
      getPayments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        { provide: AnalyticsService, useValue: analyticsService },
      ],
    }).compile();

    service = module.get(EarningsService);
  });

  describe('getSummary', () => {
    it('delegates to AnalyticsService.getEarnings scoped to the creator', () => {
      const totals = [
        {
          creator: 'creator-1',
          totalGross: '100.0000000',
          totalFees: '5.0000000',
          totalNet: '95.0000000',
          paymentCount: 2,
          asset: 'XLM',
        },
      ];
      analyticsService.getEarnings.mockReturnValue(
        new PaginatedResponseDto(totals, totals.length, 1, 1000),
      );

      const result = service.getSummary('creator-1', { from: '2025-01-01' });

      expect(analyticsService.getEarnings).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'creator-1', from: '2025-01-01' }),
      );
      expect(result).toEqual({ creator: 'creator-1', totals });
    });
  });

  describe('getBreakdown', () => {
    it('delegates to AnalyticsService.getPayments scoped to the creator', () => {
      const page = new PaginatedResponseDto([], 0, 1, 20);
      analyticsService.getPayments.mockReturnValue(page);

      const result = service.getBreakdown('creator-1', { page: 1, limit: 20 });

      expect(analyticsService.getPayments).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'creator-1', page: 1, limit: 20 }),
      );
      expect(result).toBe(page);
    });
  });

  describe('requestWithdrawal', () => {
    it('returns a pending stub scoped to the creator', () => {
      const result = service.requestWithdrawal('creator-1', {
        amount: '10.0000000',
        asset: 'XLM',
      });

      expect(result.creator).toBe('creator-1');
      expect(result.amount).toBe('10.0000000');
      expect(result.asset).toBe('XLM');
      expect(result.status).toBe('pending_manual_review');
      expect(result.id).toBeDefined();
      expect(new Date(result.requestedAt).toISOString()).toBe(result.requestedAt);
    });
  });
});

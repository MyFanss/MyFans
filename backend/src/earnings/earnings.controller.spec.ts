import { Test, TestingModule } from '@nestjs/testing';
import { EarningsController } from './earnings.controller';
import { EarningsService } from './earnings.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';

const CREATOR = { userId: 'creator-1', role: UserRole.CREATOR };

describe('EarningsController', () => {
  let controller: EarningsController;
  let service: jest.Mocked<
    Pick<EarningsService, 'getSummary' | 'getBreakdown' | 'requestWithdrawal'>
  >;

  beforeEach(async () => {
    service = {
      getSummary: jest.fn(),
      getBreakdown: jest.fn(),
      requestWithdrawal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EarningsController],
      providers: [{ provide: EarningsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(EarningsController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getSummary', () => {
    it('scopes the summary to the calling creator', () => {
      const summary = { creator: 'creator-1', totals: [] };
      service.getSummary.mockReturnValue(summary);

      const result = controller.getSummary({}, CREATOR);

      expect(service.getSummary).toHaveBeenCalledWith('creator-1', {});
      expect(result).toBe(summary);
    });
  });

  describe('getBreakdown', () => {
    it('scopes the breakdown to the calling creator', () => {
      const page = new PaginatedResponseDto([], 0, 1, 20);
      service.getBreakdown.mockReturnValue(page);

      const result = controller.getBreakdown({ page: 1, limit: 20 }, CREATOR);

      expect(service.getBreakdown).toHaveBeenCalledWith('creator-1', {
        page: 1,
        limit: 20,
      });
      expect(result).toBe(page);
    });
  });

  describe('requestWithdrawal', () => {
    it('forwards the request scoped to the calling creator', () => {
      const response = {
        id: 'w-1',
        creator: 'creator-1',
        amount: '10.0000000',
        asset: 'XLM',
        status: 'pending_manual_review' as const,
        requestedAt: new Date().toISOString(),
        note: 'stub',
      };
      service.requestWithdrawal.mockReturnValue(response);

      const result = controller.requestWithdrawal(
        { amount: '10.0000000', asset: 'XLM' },
        CREATOR,
      );

      expect(service.requestWithdrawal).toHaveBeenCalledWith('creator-1', {
        amount: '10.0000000',
        asset: 'XLM',
      });
      expect(result).toBe(response);
    });
  });
});

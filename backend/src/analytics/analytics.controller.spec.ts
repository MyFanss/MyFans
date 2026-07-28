import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PaginatedResponseDto } from '../common/dto';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';

const ADMIN = { userId: 'admin-1', role: UserRole.ADMIN };
const CREATOR = { userId: 'creator-1', role: UserRole.CREATOR };

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: jest.Mocked<
    Pick<AnalyticsService, 'getPayments' | 'getEarnings'>
  >;

  beforeEach(async () => {
    service = {
      getPayments: jest.fn(),
      getEarnings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: service },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(AnalyticsController);
  });

  afterEach(() => jest.clearAllMocks());

  const emptyPage = new PaginatedResponseDto([], 0, 1, 20);

  describe('getPayments', () => {
    it('lets an admin query without a creator filter', () => {
      service.getPayments.mockReturnValue(emptyPage);

      controller.getPayments({}, ADMIN);

      expect(service.getPayments).toHaveBeenCalledWith({});
    });

    it('lets an admin query any creator', () => {
      service.getPayments.mockReturnValue(emptyPage);

      controller.getPayments({ creator: 'someone-elses-id' }, ADMIN);

      expect(service.getPayments).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'someone-elses-id' }),
      );
    });

    it('auto-scopes a creator with no filter to their own id', () => {
      service.getPayments.mockReturnValue(emptyPage);

      controller.getPayments({}, CREATOR);

      expect(service.getPayments).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'creator-1' }),
      );
    });

    it('allows a creator to explicitly filter to their own id', () => {
      service.getPayments.mockReturnValue(emptyPage);

      controller.getPayments({ creator: 'creator-1' }, CREATOR);

      expect(service.getPayments).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'creator-1' }),
      );
    });

    it('throws ForbiddenException when a creator requests another creator', () => {
      expect(() =>
        controller.getPayments({ creator: 'someone-elses-id' }, CREATOR),
      ).toThrow(ForbiddenException);
      expect(service.getPayments).not.toHaveBeenCalled();
    });
  });

  describe('getEarnings', () => {
    it('lets an admin see cross-creator aggregates', () => {
      service.getEarnings.mockReturnValue(emptyPage);

      controller.getEarnings({}, ADMIN);

      expect(service.getEarnings).toHaveBeenCalledWith({});
    });

    it('auto-scopes a creator to their own aggregates', () => {
      service.getEarnings.mockReturnValue(emptyPage);

      controller.getEarnings({}, CREATOR);

      expect(service.getEarnings).toHaveBeenCalledWith(
        expect.objectContaining({ creator: 'creator-1' }),
      );
    });

    it('throws ForbiddenException when a creator requests another creator', () => {
      expect(() =>
        controller.getEarnings({ creator: 'someone-elses-id' }, CREATOR),
      ).toThrow(ForbiddenException);
      expect(service.getEarnings).not.toHaveBeenCalled();
    });
  });
});

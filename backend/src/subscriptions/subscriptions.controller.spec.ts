import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionStatus } from './entities/subscription-index.entity';
import {
  FanBearerGuard,
  RequestWithFan,
} from './guards/fan-bearer.guard';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: jest.Mocked<
    Pick<
      SubscriptionsService,
      'getFanCreatorSubscriptionState' | 'listCreatorSubscribers' | 'listSubscriptions'
    >
  >;

  const fan = `G${'A'.repeat(55)}`;
  const creator = `G${'B'.repeat(55)}`;

  beforeEach(async () => {
    service = {
      getFanCreatorSubscriptionState: jest.fn().mockResolvedValue({
        fan,
        creator,
        active: false,
        indexedStatus: 'none',
        indexed: null,
        chain: {
          configured: false,
          isSubscriber: null,
          simulationCost: {
            method: 'is_subscriber',
            worstCaseMinResourceFee: null,
            lastObservedMinResourceFee: null,
            updatedAt: null,
            stale: true,
          },
        },
      }),
      listCreatorSubscribers: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      listSubscriptions: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false,
        nextCursor: null,
        cursor: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: service },
        FanBearerGuard,
      ],
    }).compile();

    controller = module.get(SubscriptionsController);
  });

  it('delegates subscription-state lookup with fan from request', async () => {
    const req = { fanAddress: fan } as RequestWithFan;
    const result = await controller.getFanCreatorSubscriptionState(req, {
      creator,
    });

    expect(service.getFanCreatorSubscriptionState).toHaveBeenCalledWith(
      fan,
      creator,
    );
    expect(result).toMatchObject({
      indexedStatus: 'none',
      chain: {
        simulationCost: {
          method: 'is_subscriber',
          stale: true,
        },
      },
    });
  });

  it('delegates creator subscriber query to the service', async () => {
    await controller.listCreatorSubscribers({
      creator,
      status: 'active',
      cursor: 'abc',
      limit: 5,
    });

    expect(service.listCreatorSubscribers).toHaveBeenCalledWith(
      creator,
      'active',
      'abc',
      5,
      undefined,
    );
  });

  it('listMySubscriptions delegates to listSubscriptions with fan from request', async () => {
    const req = { fanAddress: fan } as RequestWithFan;
    await controller.listMySubscriptions(req, {
      fan,
      status: SubscriptionStatus.ACTIVE,
      sort: 'created',
      cursor: undefined,
      limit: 10,
    });

    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      SubscriptionStatus.ACTIVE,
      'created',
      undefined,
      10,
    );
  });

  it('listMySubscriptions passes sort=expiry to service', async () => {
    const req = { fanAddress: fan } as RequestWithFan;
    await controller.listMySubscriptions(req, {
      fan,
      sort: 'expiry',
      cursor: undefined,
      limit: 20,
    });

    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      undefined,
      'expiry',
      undefined,
      20,
    );
  });
});

describe('ListSubscriptionsQueryDto – status validation', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(ListSubscriptionsQueryDto, plain);
    return validate(dto);
  }

  it('passes when status is a valid SubscriptionStatus value', async () => {
    for (const value of Object.values(SubscriptionStatus)) {
      const errors = await validateDto({ fan: 'GFAN', status: value });
      expect(errors.filter((e) => e.property === 'status')).toHaveLength(0);
    }
  });

  it('fails when status is an invalid string', async () => {
    const errors = await validateDto({ fan: 'GFAN', status: 'unknown' });
    const statusErrors = errors.filter((e) => e.property === 'status');
    expect(statusErrors).toHaveLength(1);
    expect(Object.values(statusErrors[0].constraints ?? {})[0]).toMatch(
      /active, expired, cancelled/,
    );
  });

  it('passes when status is omitted', async () => {
    const errors = await validateDto({ fan: 'GFAN' });
    expect(errors.filter((e) => e.property === 'status')).toHaveLength(0);
  });

  it('passes when sort is "created"', async () => {
    const errors = await validateDto({ fan: 'GFAN', sort: 'created' });
    expect(errors.filter((e) => e.property === 'sort')).toHaveLength(0);
  });

  it('passes when sort is "expiry"', async () => {
    const errors = await validateDto({ fan: 'GFAN', sort: 'expiry' });
    expect(errors.filter((e) => e.property === 'sort')).toHaveLength(0);
  });

  it('fails when sort is an invalid value', async () => {
    const errors = await validateDto({ fan: 'GFAN', sort: 'invalid' });
    const sortErrors = errors.filter((e) => e.property === 'sort');
    expect(sortErrors).toHaveLength(1);
    expect(Object.values(sortErrors[0].constraints ?? {})[0]).toMatch(/created, expiry/);
  });

  it('passes when sort is omitted', async () => {
    const errors = await validateDto({ fan: 'GFAN' });
    expect(errors.filter((e) => e.property === 'sort')).toHaveLength(0);
  });
});

describe('SubscriptionsController – listSubscriptions', () => {
  let controller: SubscriptionsController;
  let service: jest.Mocked<Pick<SubscriptionsService, 'listSubscriptions' | 'getFanCreatorSubscriptionState'>>;

  const fan = `G${'A'.repeat(55)}`;

  beforeEach(async () => {
    service = {
      listSubscriptions: jest.fn().mockReturnValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false, nextCursor: null, cursor: null }),
      getFanCreatorSubscriptionState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: service },
        FanBearerGuard,
      ],
    }).compile();

    controller = module.get(SubscriptionsController);
  });

  it('passes typed SubscriptionStatus.ACTIVE to service', () => {
    const query: ListSubscriptionsQueryDto = { fan, status: SubscriptionStatus.ACTIVE, cursor: undefined, limit: 20 };
    controller.listSubscriptions(query);
    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      SubscriptionStatus.ACTIVE,
      undefined,
      undefined,
      20,
    );
  });

  it('passes typed SubscriptionStatus.EXPIRED to service', () => {
    const query: ListSubscriptionsQueryDto = { fan, status: SubscriptionStatus.EXPIRED, cursor: undefined, limit: 20 };
    controller.listSubscriptions(query);
    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      SubscriptionStatus.EXPIRED,
      undefined,
      undefined,
      20,
    );
  });

  it('passes sort=created to service', () => {
    const query: ListSubscriptionsQueryDto = { fan, sort: 'created', cursor: undefined, limit: 20 };
    controller.listSubscriptions(query);
    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      undefined,
      'created',
      undefined,
      20,
    );
  });

  it('passes sort=expiry to service', () => {
    const query: ListSubscriptionsQueryDto = { fan, sort: 'expiry', cursor: undefined, limit: 20 };
    controller.listSubscriptions(query);
    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      undefined,
      'expiry',
      undefined,
      20,
    );
  });

  it('passes cursor to service', () => {
    const query: ListSubscriptionsQueryDto = { fan, cursor: 'some-cursor', limit: 10 };
    controller.listSubscriptions(query);
    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      undefined,
      undefined,
      'some-cursor',
      10,
    );
  });

  it('passes undefined status when omitted', () => {
    const query: ListSubscriptionsQueryDto = { fan, cursor: undefined, limit: 20 };
    controller.listSubscriptions(query);
    expect(service.listSubscriptions).toHaveBeenCalledWith(
      fan,
      undefined,
      undefined,
      undefined,
      20,
    );
  });
});

describe('FanBearerGuard', () => {
  let guard: FanBearerGuard;

  beforeEach(() => {
    guard = new FanBearerGuard();
  });

  it('throws when Authorization is missing', () => {
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as never),
    ).toThrow(UnauthorizedException);
  });

  it('attaches fanAddress for valid Bearer token', () => {
    const fanAddr = `G${'C'.repeat(55)}`;
    const token = Buffer.from(fanAddr, 'utf8').toString('base64');
    const req: { headers: Record<string, string>; fanAddress?: string } = {
      headers: { authorization: `Bearer ${token}` },
    };

    expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).toBe(true);
    expect(req.fanAddress).toBe(fanAddr);
  });
});

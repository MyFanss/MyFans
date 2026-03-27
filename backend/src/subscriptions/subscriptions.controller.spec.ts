import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import {
  FanBearerGuard,
  RequestWithFan,
} from './guards/fan-bearer.guard';

describe('SubscriptionsController (subscription-state)', () => {
  let controller: SubscriptionsController;
  let service: jest.Mocked<
    Pick<SubscriptionsService, 'getFanCreatorSubscriptionState'>
  >;

  beforeEach(async () => {
    service = {
      getFanCreatorSubscriptionState: jest.fn().mockResolvedValue({
        fan: 'FX',
        creator: 'CY',
        active: false,
        indexedStatus: 'none',
        indexed: null,
        chain: { configured: false, isSubscriber: null },
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

  const fan = `G${'A'.repeat(55)}`;
  const creator = `G${'B'.repeat(55)}`;

  it('delegates to service with fan from request', async () => {
    const req = { fanAddress: fan } as RequestWithFan;
    const result = await controller.getFanCreatorSubscriptionState(req, {
      creator,
    });

    expect(service.getFanCreatorSubscriptionState).toHaveBeenCalledWith(
      fan,
      creator,
    );
    expect(result).toMatchObject({ indexedStatus: 'none' });
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

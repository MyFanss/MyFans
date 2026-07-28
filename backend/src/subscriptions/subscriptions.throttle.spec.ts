import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from '../feature-flags/feature-flag.guard';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { FanBearerGuard } from './guards/fan-bearer.guard';

// Decorator metadata lives on the unbound prototype methods, so reading it
// back is exactly what these specs are meant to do.
/* eslint-disable @typescript-eslint/unbound-method */

describe('SubscriptionsController – rate limiting', () => {
  let controller: SubscriptionsController;

  const mockService = {
    createCheckout: jest.fn().mockReturnValue({
      id: 'chk-1',
      fanAddress: 'GFAN',
      creatorAddress: 'GCREATOR',
      planId: 1,
      assetCode: 'XLM',
      amount: '10',
      fee: '0.5',
      total: '10.5',
      status: 'pending',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    getCheckout: jest.fn().mockReturnValue({
      id: 'chk-1',
      fanAddress: 'GFAN',
      creatorAddress: 'GCREATOR',
      planId: 1,
      assetCode: 'XLM',
      amount: '10',
      fee: '0.5',
      total: '10.5',
      status: 'pending',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    validateBalance: jest
      .fn()
      .mockReturnValue({ valid: true, balance: '1000' }),
    confirmSubscription: jest.fn().mockResolvedValue({ success: true }),
    failCheckout: jest.fn().mockReturnValue({ success: false }),
    cancelSubscription: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'short', ttl: 60000, limit: 10 }]),
      ],
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockService },
        FanBearerGuard,
        Reflector,
        FeatureFlagGuard,
        {
          provide: FeatureFlagsService,
          useValue: { isEnabled: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    controller = module.get(SubscriptionsController);
  });

  it('should have ThrottlerGuard applied at controller level', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      SubscriptionsController,
    ) as unknown;
    expect(guards).toBeDefined();
    expect(guards).toContain(ThrottlerGuard);
  });

  it('should have throttle metadata on createCheckout', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      SubscriptionsController.prototype.createCheckout,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on validateBalance', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      SubscriptionsController.prototype.validateBalance,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on confirmSubscription', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      SubscriptionsController.prototype.confirmSubscription,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on failCheckout', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      SubscriptionsController.prototype.failCheckout,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('should have throttle metadata on cancelSubscription', () => {
    const metadata = Reflect.getMetadata(
      'THROTTLER:LIMITshort',
      SubscriptionsController.prototype.cancelSubscription,
    ) as unknown;
    expect(metadata).toBeDefined();
  });

  it('write endpoints still delegate to service when within rate limit', () => {
    controller.createCheckout(
      { fanAddress: 'GFAN', creatorAddress: 'GCREATOR', planId: 1 },
      undefined,
    );
    expect(mockService.createCheckout).toHaveBeenCalled();

    controller.cancelSubscription({
      fanAddress: 'GFAN',
      creatorAddress: 'GCREATOR',
    });
    expect(mockService.cancelSubscription).toHaveBeenCalled();
  });
});

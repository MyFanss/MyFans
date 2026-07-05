import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsController } from './feature-flags.controller';
import {
  FeatureFlagsService,
  FeatureFlagsSnapshot,
} from './feature-flags.service';

describe('FeatureFlagsController', () => {
  let controller: FeatureFlagsController;
  let featureFlagsService: jest.Mocked<
    Pick<FeatureFlagsService, 'getAllFlags'>
  >;

  beforeEach(async () => {
    featureFlagsService = {
      getAllFlags: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [
        { provide: FeatureFlagsService, useValue: featureFlagsService },
      ],
    }).compile();

    controller = module.get(FeatureFlagsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the feature flag snapshot from the service', () => {
    const snapshot: FeatureFlagsSnapshot = {
      bookmarks: true,
      earnings_withdrawals: false,
      earnings_fee_transparency: true,
      newSubscriptionFlow: true,
      cryptoPayments: false,
      referralCodes: true,
      sorobanPoller: true,
    };
    featureFlagsService.getAllFlags.mockReturnValue(snapshot);

    expect(controller.getFlags()).toBe(snapshot);
    expect(featureFlagsService.getAllFlags).toHaveBeenCalledTimes(1);
  });
});

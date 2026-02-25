import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureFlagsService],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false when flag is not set', () => {
    delete process.env.FEATURE_NEW_SUBSCRIPTION_FLOW;
    expect(service.isNewSubscriptionFlowEnabled()).toBe(false);
  });

  it('should return true when flag is set to true', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';
    expect(service.isNewSubscriptionFlowEnabled()).toBe(true);
  });

  it('should return false when flag is set to false', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'false';
    expect(service.isNewSubscriptionFlowEnabled()).toBe(false);
  });

  it('should return all flags', () => {
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';
    process.env.FEATURE_CRYPTO_PAYMENTS = 'false';
    
    const flags = service.getAllFlags();
    
    expect(flags).toEqual({
      newSubscriptionFlow: true,
      cryptoPayments: false,
    });
  });
});

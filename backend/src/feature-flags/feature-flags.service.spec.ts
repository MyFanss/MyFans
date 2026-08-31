import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'SOROBAN_RPC_URL') return process.env.SOROBAN_RPC_URL;
              if (key === 'CONTRACT_ID_SUBSCRIPTION') return process.env.CONTRACT_ID_SUBSCRIPTION;
              if (key === 'SUBSCRIPTION_CONTRACT_ID') return process.env.SUBSCRIPTION_CONTRACT_ID;
              if (key === 'CONTRACT_ID_MYFANS') return process.env.CONTRACT_ID_MYFANS;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(() => {
    delete process.env.FEATURE_FLAG_BOOKMARKS;
    delete process.env.NEXT_PUBLIC_FLAG_BOOKMARKS;
    delete process.env.FEATURE_FLAG_EARNINGS_WITHDRAWALS;
    delete process.env.NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS;
    delete process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY;
    delete process.env.NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY;
    delete process.env.FEATURE_NEW_SUBSCRIPTION_FLOW;
    delete process.env.FEATURE_CRYPTO_PAYMENTS;
    delete process.env.FEATURE_REFERRAL_CODES;
    delete process.env.FEATURE_SOROBAN_POLLER;
    delete process.env.SOROBAN_RPC_URL;
    delete process.env.CONTRACT_ID_SUBSCRIPTION;
    delete process.env.SUBSCRIPTION_CONTRACT_ID;
    delete process.env.CONTRACT_ID_MYFANS;
  });

  it('returns false when a flag is not set', () => {
    expect(service.isEnabled('bookmarks')).toBe(false);
  });

  it('accepts explicit backend feature flag env vars', () => {
    process.env.FEATURE_FLAG_BOOKMARKS = 'true';

    expect(service.isEnabled('bookmarks')).toBe(true);
  });

  it('falls back to matching frontend env vars for shared runtime configs', () => {
    process.env.NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS = 'true';

    expect(service.isEnabled('earnings_withdrawals')).toBe(true);
  });

  it('returns safe defaults for invalid env values', () => {
    process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY = 'definitely';

    expect(service.isEnabled('earnings_fee_transparency')).toBe(false);
  });

  it('returns the full feature flag payload', () => {
    process.env.FEATURE_FLAG_BOOKMARKS = 'true';
    process.env.FEATURE_FLAG_EARNINGS_WITHDRAWALS = 'false';
    process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY = '1';
    process.env.FEATURE_NEW_SUBSCRIPTION_FLOW = 'true';
    process.env.FEATURE_CRYPTO_PAYMENTS = 'true';
    process.env.FEATURE_REFERRAL_CODES = 'true';
    process.env.FEATURE_SOROBAN_POLLER = 'true';

    expect(service.getAllFlags()).toEqual({
      bookmarks: true,
      earnings_withdrawals: false,
      earnings_fee_transparency: true,
      newSubscriptionFlow: true,
      cryptoPayments: true,
      referralCodes: true,
      sorobanPoller: true,
    });
  });

  describe('isSorobanPollerEnabled', () => {
    it('uses explicit value when FEATURE_SOROBAN_POLLER is set', () => {
      process.env.FEATURE_SOROBAN_POLLER = 'false';
      expect(service.isSorobanPollerEnabled()).toBe(false);

      process.env.FEATURE_SOROBAN_POLLER = 'true';
      expect(service.isSorobanPollerEnabled()).toBe(true);
    });

    it('defaults to disabled in test environment when not explicitly set', () => {
      delete process.env.FEATURE_SOROBAN_POLLER;
      expect(service.isSorobanPollerEnabled()).toBe(false);
    });

    it('defaults to enabled in production when configured', () => {
      delete process.env.FEATURE_SOROBAN_POLLER;
      process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
      process.env.CONTRACT_ID_SUBSCRIPTION = 'CAAAAAAA...';

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'SOROBAN_RPC_URL') return process.env.SOROBAN_RPC_URL;
        if (key === 'CONTRACT_ID_SUBSCRIPTION') return process.env.CONTRACT_ID_SUBSCRIPTION;
        return undefined;
      });

      expect(service.isSorobanPollerEnabled()).toBe(true);
    });

    it('defaults to disabled in production when RPC is missing', () => {
      delete process.env.FEATURE_SOROBAN_POLLER;
      delete process.env.SOROBAN_RPC_URL;
      process.env.CONTRACT_ID_SUBSCRIPTION = 'CAAAAAAA...';

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'SOROBAN_RPC_URL') return undefined;
        if (key === 'CONTRACT_ID_SUBSCRIPTION') return process.env.CONTRACT_ID_SUBSCRIPTION;
        return undefined;
      });

      expect(service.isSorobanPollerEnabled()).toBe(false);
    });

    it('defaults to disabled in production when contract ID is missing', () => {
      delete process.env.FEATURE_SOROBAN_POLLER;
      process.env.SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
      delete process.env.CONTRACT_ID_SUBSCRIPTION;

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'SOROBAN_RPC_URL') return process.env.SOROBAN_RPC_URL;
        if (key === 'CONTRACT_ID_SUBSCRIPTION') return undefined;
        return undefined;
      });

      expect(service.isSorobanPollerEnabled()).toBe(false);
    });
  });
});

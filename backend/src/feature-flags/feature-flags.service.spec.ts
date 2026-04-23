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

  afterEach(() => {
    delete process.env.FEATURE_FLAG_BOOKMARKS;
    delete process.env.NEXT_PUBLIC_FLAG_BOOKMARKS;
    delete process.env.FEATURE_FLAG_EARNINGS_WITHDRAWALS;
    delete process.env.NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS;
    delete process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY;
    delete process.env.NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY;
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

  it('returns the frontend-compatible feature flag payload', () => {
    process.env.FEATURE_FLAG_BOOKMARKS = 'true';
    process.env.FEATURE_FLAG_EARNINGS_WITHDRAWALS = 'false';
    process.env.FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY = '1';

    expect(service.getAllFlags()).toEqual({
      flags: {
        bookmarks: true,
        earnings_withdrawals: false,
        earnings_fee_transparency: true,
      },
    });
  });
});

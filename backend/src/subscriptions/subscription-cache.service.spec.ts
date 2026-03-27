import { SubscriptionCacheService } from './subscription-cache.service';

describe('SubscriptionCacheService', () => {
  let cache: SubscriptionCacheService;
  const fan = 'GFAN1111111111111111111111111111111111111111111111111111';
  const creator = 'GCREATOR111111111111111111111111111111111111111111111111';

  beforeEach(() => {
    cache = new SubscriptionCacheService();
  });

  it('returns false for unknown pair', () => {
    expect(cache.get(fan, creator)).toBe(false);
  });

  it('returns true after set', () => {
    cache.set(fan, creator);
    expect(cache.get(fan, creator)).toBe(true);
  });

  it('returns false after invalidate', () => {
    cache.set(fan, creator);
    cache.invalidate(fan, creator);
    expect(cache.get(fan, creator)).toBe(false);
  });

  it('expires entries after TTL', () => {
    jest.useFakeTimers();
    cache.set(fan, creator);
    jest.advanceTimersByTime(61_000);
    expect(cache.get(fan, creator)).toBe(false);
    jest.useRealTimers();
  });
});

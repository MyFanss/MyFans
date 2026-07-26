import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analytics,
  consoleProvider,
  noopProvider,
  realProvider,
  resetAnalyticsProvider,
  resolveAnalyticsProviderName,
  setAnalyticsProvider,
} from './analytics';

describe('resolveAnalyticsProviderName', () => {
  it('defaults to console in development', () => {
    expect(resolveAnalyticsProviderName(undefined, 'development')).toBe('console');
  });

  it('defaults to noop in production', () => {
    expect(resolveAnalyticsProviderName(undefined, 'production')).toBe('noop');
  });

  it('honors explicit provider names', () => {
    expect(resolveAnalyticsProviderName('real', 'production')).toBe('real');
    expect(resolveAnalyticsProviderName('NOOP', 'development')).toBe('noop');
  });
});

describe('analytics consent gating', () => {
  beforeEach(() => {
    localStorage.clear();
    setAnalyticsProvider({
      name: 'test',
      track: vi.fn(),
      identify: vi.fn(),
    });
  });

  afterEach(() => {
    resetAnalyticsProvider();
  });

  it('does not track without consent', () => {
    const provider = {
      name: 'test',
      track: vi.fn(),
      identify: vi.fn(),
    };
    setAnalyticsProvider(provider);

    analytics.trackEvent('page_view');
    analytics.identifyUser('user-1');

    expect(provider.track).not.toHaveBeenCalled();
    expect(provider.identify).not.toHaveBeenCalled();
  });

  it('tracks when consent is granted', () => {
    localStorage.setItem('telemetry_consent', 'true');
    const provider = {
      name: 'test',
      track: vi.fn(),
      identify: vi.fn(),
    };
    setAnalyticsProvider(provider);

    analytics.trackEvent('plan_created', { planId: 'p1' });
    analytics.identifyUser('user-1', { role: 'creator' });

    expect(provider.track).toHaveBeenCalledWith('plan_created', { planId: 'p1' });
    expect(provider.identify).toHaveBeenCalledWith('user-1', { role: 'creator' });
  });
});

describe('providers', () => {
  it('noop provider does nothing', () => {
    expect(() => noopProvider.track('x')).not.toThrow();
    expect(() => noopProvider.identify('u')).not.toThrow();
  });

  it('console provider logs in debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleProvider.track('evt', { a: 1 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('real provider posts to endpoint when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const prev = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = 'https://example.test/collect';

    realProvider.track('click', { btn: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/collect',
      expect.objectContaining({ method: 'POST' }),
    );

    process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT = prev;
    vi.unstubAllGlobals();
  });
});

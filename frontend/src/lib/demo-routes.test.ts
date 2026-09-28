import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoRoutesEnabled, isDemoRoute } from './demo-routes';

describe('isDemoRoute', () => {
  it('matches the demo prefix and nested paths', () => {
    expect(isDemoRoute('/demo')).toBe(true);
    expect(isDemoRoute('/demo/wallet')).toBe(true);
  });

  it('does not match lookalike or unrelated paths', () => {
    expect(isDemoRoute('/demos')).toBe(false);
    expect(isDemoRoute('/demonstration')).toBe(false);
    expect(isDemoRoute('/')).toBe(false);
    expect(isDemoRoute('/dashboard')).toBe(false);
  });
});

describe('demoRoutesEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is enabled outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_FLAG_DEMOS', '');
    expect(demoRoutesEnabled()).toBe(true);
  });

  it('is disabled in production by default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FLAG_DEMOS', '');
    expect(demoRoutesEnabled()).toBe(false);
  });

  it('can be re-enabled in production via NEXT_PUBLIC_FLAG_DEMOS', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FLAG_DEMOS', 'true');
    expect(demoRoutesEnabled()).toBe(true);
  });
});

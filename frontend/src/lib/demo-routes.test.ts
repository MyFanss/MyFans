import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ROUTES, demoRoutesEnabled, isDemoRoute } from './demo-routes';

describe('demo-routes', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.NEXT_PUBLIC_FLAG_DEMOS;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FLAG_DEMOS;
  });

  afterEach(() => {
    // @ts-expect-error - test-only reassignment
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.NEXT_PUBLIC_FLAG_DEMOS;
    else process.env.NEXT_PUBLIC_FLAG_DEMOS = originalFlag;
  });

  describe('isDemoRoute', () => {
    it('matches every known demo route and its sub-paths', () => {
      for (const route of DEMO_ROUTES) {
        expect(isDemoRoute(route)).toBe(true);
        expect(isDemoRoute(`${route}/nested`)).toBe(true);
      }
    });

    it('does not match product routes', () => {
      for (const path of ['/', '/discover', '/subscriptions', '/creator/jane', '/uikit']) {
        expect(isDemoRoute(path)).toBe(false);
      }
    });
  });

  describe('demoRoutesEnabled', () => {
    it('is enabled outside production', () => {
      // @ts-expect-error - test-only reassignment
      process.env.NODE_ENV = 'development';
      expect(demoRoutesEnabled()).toBe(true);
    });

    it('is disabled in production without the opt-in flag', () => {
      // @ts-expect-error - test-only reassignment
      process.env.NODE_ENV = 'production';
      expect(demoRoutesEnabled()).toBe(false);
    });

    it('is enabled in production when NEXT_PUBLIC_FLAG_DEMOS=true', () => {
      // @ts-expect-error - test-only reassignment
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_FLAG_DEMOS = 'true';
      expect(demoRoutesEnabled()).toBe(true);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  errorToastWithCause,
  subscribeToCreatorFailed,
  subscriptionActionToast,
  subscriptionsLoadFailed,
} from '@/lib/error-copy';

describe('error-copy', () => {
  it('errorToastWithCause uses base copy and appends truncated cause', () => {
    const out = errorToastWithCause('NETWORK_ERROR', new Error('ECONNREFUSED'));
    expect(out.message).toBeTruthy();
    expect(out.description).toContain('ECONNREFUSED');
    expect(out.description?.length).toBeLessThan(500);
  });

  it('errorToastWithCause omits empty cause', () => {
    const out = errorToastWithCause('COPY_FAILED', null);
    expect(out.message).toBeTruthy();
    expect(out.description).not.toMatch(/\(\s*\)/);
  });

  it('subscribeToCreatorFailed names the creator and includes a next step', () => {
    const out = subscribeToCreatorFailed('Ada');
    expect(out.message).toContain('Ada');
    expect(out.description?.toLowerCase()).toMatch(/wallet|subscribe|refresh/);
  });

  it('subscriptionActionToast entries include actionable guidance', () => {
    for (const fn of [
      subscriptionActionToast.cancelFailed,
      subscriptionActionToast.renewFailed,
    ]) {
      const out = fn();
      expect(out.message.length).toBeGreaterThan(5);
      expect(out.description && out.description.length).toBeGreaterThan(20);
    }
  });

  it('subscriptionsLoadFailed mentions refresh and backend', () => {
    const out = subscriptionsLoadFailed();
    expect(out.message).toMatch(/subscription/i);
    expect(out.description?.toLowerCase()).toMatch(/refresh|backend/);
  });
});

describe('ErrorCode defaults (integration)', () => {
  it('new product codes resolve via createAppError', async () => {
    const { createAppError } = await import('@/types/errors');
    for (const code of ['COPY_FAILED', 'SAVE_FAILED', 'PUBLISH_FAILED', 'ACCESS_DENIED'] as const) {
      const err = createAppError(code);
      expect(err.message.length).toBeGreaterThan(3);
      expect(err.description && err.description.length).toBeGreaterThan(15);
    }
  });
});

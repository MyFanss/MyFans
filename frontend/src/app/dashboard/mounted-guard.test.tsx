/**
 * Regression coverage for #2016: each dashboard page must clear
 * `mountedRef.current` on unmount and guard every post-await dispatch with
 * it, so an in-flight request that resolves after teardown never attempts
 * a state update. Without the guard, React logs an "update ... not wrapped
 * in act(...)" warning for the late dispatch — that warning is what these
 * tests watch for.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import DashboardPlansPage from './plans/page';
import DashboardContentPage from './content/page';
import DashboardEarningsPage from './earnings/page';
import DashboardSubscribersPage from './subscribers/page';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('dashboard pages: mountedRef guard against post-unmount dispatch', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    apiFetch.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('plans: a load that resolves after unmount does not dispatch', async () => {
    const pending = deferred<Response>();
    apiFetch.mockReturnValue(pending.promise);

    const { unmount } = render(<DashboardPlansPage />);
    unmount();

    pending.resolve(okResponse([]));
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('content: a load that resolves after unmount does not dispatch', async () => {
    const pending = deferred<Response>();
    apiFetch.mockReturnValue(pending.promise);

    const { unmount } = render(<DashboardContentPage />);
    unmount();

    pending.resolve(okResponse({ data: [], nextCursor: null }));
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('earnings: a load that resolves after unmount does not dispatch', async () => {
    const pending = deferred<Response>();
    apiFetch.mockReturnValue(pending.promise);

    const { unmount } = render(<DashboardEarningsPage />);
    unmount();

    pending.resolve(okResponse({ balances: [] }));
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('subscribers: a load that resolves after unmount does not dispatch', async () => {
    const pending = deferred<Response>();
    apiFetch.mockReturnValue(pending.promise);

    const { unmount } = render(<DashboardSubscribersPage />);
    unmount();

    pending.resolve(okResponse({ data: [], nextCursor: null, total: 0 }));
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('subscribers: a load that rejects after unmount does not dispatch', async () => {
    const pending = deferred<Response>();
    pending.promise.catch(() => {});
    apiFetch.mockReturnValue(pending.promise);

    const { unmount } = render(<DashboardSubscribersPage />);
    unmount();

    pending.reject(new Error('network error'));
    await flush();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

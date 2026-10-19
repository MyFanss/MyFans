/**
 * Unit tests for useNetworkGuard — focuses on the poll interval protection
 * that prevents overlapping in-flight `resolveActual` calls (issue #1991).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkGuard } from './useNetworkGuard';

describe('useNetworkGuard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips interval ticks while resolveActual is in flight and resumes once it settles', async () => {
    vi.useFakeTimers();

    let resolveDeferred: (network: string) => void = () => {};
    const resolveActual = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveDeferred = resolve;
        }),
    );

    const { result, unmount } = renderHook(() =>
      useNetworkGuard({ resolveActual, pollIntervalMs: 5000 }),
    );

    // Initial refresh on mount.
    expect(resolveActual).toHaveBeenCalledTimes(1);
    expect(result.current.blocked).toBe(true);

    // With the resolution pending, ticks must not stack up: only one call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(resolveActual).toHaveBeenCalledTimes(1);
    expect(result.current.blocked).toBe(true);

    // Settle the pending resolution; the latest result is reflected in state.
    await act(async () => {
      resolveDeferred('testnet');
    });
    expect(resolveActual).toHaveBeenCalledTimes(1);
    expect(result.current.blocked).toBe(false);
    expect(result.current.actual).toBe('testnet');
    expect(result.current.mismatch).toBe(false);

    // Once settled, the next interval tick polls again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(resolveActual).toHaveBeenCalledTimes(2);
    expect(result.current.blocked).toBe(false);

    unmount();
  });

  it('keeps assertCanMutate failing closed when blocked and passing when the network matches', async () => {
    vi.useFakeTimers();

    let resolveDeferred: (network: string) => void = () => {};
    const resolveActual = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveDeferred = resolve;
        }),
    );

    const { result, unmount } = renderHook(() =>
      useNetworkGuard({ resolveActual, pollIntervalMs: 5000 }),
    );

    // Fail closed while the actual network is unknown.
    expect(() => result.current.assertCanMutate()).toThrow(/blocked/i);

    await act(async () => {
      resolveDeferred('testnet');
    });

    // Matching network: mutations are allowed.
    expect(() => result.current.assertCanMutate()).not.toThrow();

    unmount();
  });

  it('does not poll again after unmount (cancelled behaviour preserved)', async () => {
    vi.useFakeTimers();

    const resolveActual = vi.fn().mockResolvedValue('testnet');

    const { unmount } = renderHook(() =>
      useNetworkGuard({ resolveActual, pollIntervalMs: 5000 }),
    );

    expect(resolveActual).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(resolveActual).toHaveBeenCalledTimes(1);
  });

  it('fails closed when no resolver is configured', async () => {
    const { result } = renderHook(() => useNetworkGuard());

    expect(result.current.actual).toBe('unknown');
    expect(result.current.unreachable).toBe(true);
    expect(result.current.blocked).toBe(true);
    expect(() => result.current.assertCanMutate()).toThrow(/blocked/i);
  });
});
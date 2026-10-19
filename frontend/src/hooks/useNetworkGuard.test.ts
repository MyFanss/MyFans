import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNetworkGuard } from './useNetworkGuard';

describe('useNetworkGuard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails closed when no resolver is configured', () => {
    const { result } = renderHook(() => useNetworkGuard({ pollIntervalMs: 0 }));

    expect(result.current.expected).toBe('testnet');
    expect(result.current.actual).toBe('unknown');
    expect(result.current.mismatch).toBe(true);
    expect(result.current.unreachable).toBe(true);
    expect(result.current.blocked).toBe(true);
    expect(result.current.reason).toBe('Network unreachable — mutating calls are blocked.');
    expect(() => result.current.assertCanMutate()).toThrow(
      'Network unreachable — mutating calls are blocked.',
    );
  });

  it('covers matching network (testnet / testnet) as unblocked', async () => {
    const resolveActual = vi.fn().mockResolvedValue('testnet');
    const { result } = renderHook(() =>
      useNetworkGuard({ expected: 'testnet', resolveActual, pollIntervalMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.actual).toBe('testnet');
    });

    expect(result.current.expected).toBe('testnet');
    expect(result.current.mismatch).toBe(false);
    expect(result.current.unreachable).toBe(false);
    expect(result.current.blocked).toBe(false);
    expect(result.current.reason).toBeNull();
    expect(() => result.current.assertCanMutate()).not.toThrow();
  });

  it('covers mismatched network (testnet / mainnet) as blocked with mismatch reason', async () => {
    const resolveActual = vi.fn().mockResolvedValue('mainnet');
    const { result } = renderHook(() =>
      useNetworkGuard({ expected: 'testnet', resolveActual, pollIntervalMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.actual).toBe('mainnet');
    });

    expect(result.current.expected).toBe('testnet');
    expect(result.current.mismatch).toBe(true);
    expect(result.current.unreachable).toBe(false);
    expect(result.current.blocked).toBe(true);
    expect(result.current.reason).toBe('Network mismatch: expected testnet, connected to mainnet.');
    expect(() => result.current.assertCanMutate()).toThrow(
      'Network mismatch: expected testnet, connected to mainnet.',
    );
  });

  it('covers unknown network (testnet / unknown) as blocked with unknown-network reason', async () => {
    const resolveActual = vi.fn().mockResolvedValue('unknown');
    const { result } = renderHook(() =>
      useNetworkGuard({ expected: 'testnet', resolveActual, pollIntervalMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.actual).toBe('unknown');
    });

    expect(result.current.expected).toBe('testnet');
    expect(result.current.mismatch).toBe(true);
    expect(result.current.unreachable).toBe(false);
    expect(result.current.blocked).toBe(true);
    expect(result.current.reason).toBe('Unknown network — mutating calls are blocked.');
    expect(() => result.current.assertCanMutate()).toThrow(
      'Unknown network — mutating calls are blocked.',
    );
  });

  it('covers rejected resolveActual as blocked with unreachable reason', async () => {
    const resolveActual = vi.fn().mockRejectedValue(new Error('RPC failure'));
    const { result } = renderHook(() =>
      useNetworkGuard({ expected: 'testnet', resolveActual, pollIntervalMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.unreachable).toBe(true);
    });

    expect(result.current.expected).toBe('testnet');
    expect(result.current.actual).toBe('unknown');
    expect(result.current.mismatch).toBe(true);
    expect(result.current.blocked).toBe(true);
    expect(result.current.reason).toBe('Network unreachable — mutating calls are blocked.');
    expect(() => result.current.assertCanMutate()).toThrow(
      'Network unreachable — mutating calls are blocked.',
    );
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
});

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRpcStatus } from '@/hooks/useRpcStatus';

// Mock contract-config so we control the RPC URL
vi.mock('@/lib/contract-config', () => ({
  getStellarRuntimeConfig: () => ({
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    network: 'testnet',
    subscriptionContractId: '',
  }),
}));

describe('useRpcStatus', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  }

  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine);
    }
  });

  it('starts as online when navigator.onLine is true and RPC responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const { result } = renderHook(() => useRpcStatus());

    await waitFor(() => expect(result.current.status).toBe('online'), { timeout: 10000 });
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isBrowserOffline).toBe(false);
    expect(result.current.isRpcDown).toBe(false);
  });

  it('reports rpc_down when RPC fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useRpcStatus());

    await waitFor(() => expect(result.current.isRpcDown).toBe(true), { timeout: 10000 });
    expect(result.current.status).toBe('rpc_down');
    expect(result.current.isOffline).toBe(true);
  });

  it('reports offline when browser goes offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const { result } = renderHook(() => useRpcStatus());
    await waitFor(() => expect(result.current.status).toBe('online'), { timeout: 10000 });

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isBrowserOffline).toBe(true);
    expect(result.current.isOffline).toBe(true);
    expect(result.current.status).toBe('offline');
  });

  it('recovers to online when browser comes back online and RPC is reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const { result } = renderHook(() => useRpcStatus());
    await waitFor(() => expect(result.current.status).toBe('online'), { timeout: 10000 });

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isBrowserOffline).toBe(true);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.isBrowserOffline).toBe(false), { timeout: 10000 });
    await waitFor(() => expect(result.current.status).toBe('online'), { timeout: 10000 });
  });

  it('retry triggers a new RPC probe', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRpcStatus());
    await waitFor(() => expect(result.current.isRpcDown).toBe(true), { timeout: 10000 });

    // Now fix the RPC
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isRpcDown).toBe(false), { timeout: 10000 });
  });
});

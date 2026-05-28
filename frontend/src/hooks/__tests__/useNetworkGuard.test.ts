import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkGuard } from '../useNetworkGuard';

// Mock contract-config so we control the expected network
vi.mock('@/lib/contract-config', () => ({
  getRuntimeContractConfig: vi.fn(() => ({ network: 'testnet' })),
}));

function setFreighter(getNetwork: (() => Promise<{ network: string; networkPassphrase: string }>) | undefined) {
  (window as any).freighter = getNetwork ? { getNetwork } : undefined;
}

describe('useNetworkGuard', () => {
  afterEach(() => {
    delete (window as any).freighter;
    vi.clearAllMocks();
  });

  it('reports no mismatch when freighter is absent', async () => {
    setFreighter(undefined);
    const { result } = renderHook(() => useNetworkGuard());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.mismatch).toBe(false);
    expect(result.current.detected).toBeNull();
  });

  it('reports no mismatch when wallet is on the correct network', async () => {
    setFreighter(async () => ({ network: 'TESTNET', networkPassphrase: '' }));
    const { result } = renderHook(() => useNetworkGuard());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.mismatch).toBe(false);
    expect(result.current.expected).toBe('testnet');
  });

  it('reports mismatch when wallet is on a different network', async () => {
    setFreighter(async () => ({ network: 'PUBLIC', networkPassphrase: '' }));
    const { result } = renderHook(() => useNetworkGuard());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.mismatch).toBe(true);
    expect(result.current.detected).toBe('PUBLIC');
  });

  it('re-checks on freighter:networkChanged event', async () => {
    // Start on wrong network
    setFreighter(async () => ({ network: 'PUBLIC', networkPassphrase: '' }));
    const { result } = renderHook(() => useNetworkGuard());
    await waitFor(() => expect(result.current.mismatch).toBe(true));

    // Switch to correct network
    setFreighter(async () => ({ network: 'TESTNET', networkPassphrase: '' }));
    act(() => {
      window.dispatchEvent(new Event('freighter:networkChanged'));
    });
    await waitFor(() => expect(result.current.mismatch).toBe(false));
  });

  it('handles getNetwork() throwing without crashing', async () => {
    setFreighter(async () => { throw new Error('wallet locked'); });
    const { result } = renderHook(() => useNetworkGuard());
    await waitFor(() => expect(result.current.checking).toBe(false));
    expect(result.current.mismatch).toBe(false);
  });
});

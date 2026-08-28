import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBackendNetwork } from '../useBackendNetwork';

// Control the build-time network the hook seeds its initial state from.
vi.mock('@/lib/contract-config', () => ({
  getRuntimeContractConfig: vi.fn(() => ({ network: 'testnet' })),
}));

vi.mock('@/lib/api/base-url', () => ({
  getVersionedApiBaseUrl: () => 'http://api.test/api/v1',
}));

describe('useBackendNetwork', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shows "Stellar Testnet" for a testnet build (no Mainnet string)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const { result } = renderHook(() => useBackendNetwork());

    expect(result.current).toBe('Stellar Testnet');
    expect(result.current).not.toMatch(/mainnet/i);
  });

  it('updates the label from the backend /config/network response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ network: 'futurenet' }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBackendNetwork());

    await waitFor(() => expect(result.current).toBe('Stellar Futurenet'));
  });

  it('only says "Public" when the backend reports the public network', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ network: 'public' }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useBackendNetwork());

    await waitFor(() => expect(result.current).toBe('Stellar Public'));
  });
});

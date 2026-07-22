import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewerSubscriptionStatus } from '@/hooks/useViewerSubscriptionStatus';

const mockUseWallet = vi.fn();
vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useViewerSubscriptionStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseWallet.mockReturnValue({
      isConnected: false,
      address: null,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ active: false }),
    });
  });

  it('degrades to null when viewer is logged out / no wallet connected', async () => {
    mockUseWallet.mockReturnValue({ isConnected: false, address: null });

    const { result } = renderHook(() => useViewerSubscriptionStatus('jane'));

    expect(result.current.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches live status and returns active when viewer is subscribed', async () => {
    mockUseWallet.mockReturnValue({ isConnected: true, address: 'G_FAN_123' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ active: true, indexedStatus: 'active' }),
    });

    const { result } = renderHook(() => useViewerSubscriptionStatus('jane'));

    await waitFor(() => {
      expect(result.current.status).toBe('active');
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/subscriptions/me/subscription-state?creator=jane'),
    );
  });

  it('returns expired when backend returns expired status', async () => {
    mockUseWallet.mockReturnValue({ isConnected: true, address: 'G_FAN_123' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ active: false, indexedStatus: 'expired' }),
    });

    const { result } = renderHook(() => useViewerSubscriptionStatus('alex'));

    await waitFor(() => {
      expect(result.current.status).toBe('expired');
    });
  });

  it('returns cancelled when backend returns cancelled status', async () => {
    mockUseWallet.mockReturnValue({ isConnected: true, address: 'G_FAN_123' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ active: false, indexed: { status: 'cancelled' } }),
    });

    const { result } = renderHook(() => useViewerSubscriptionStatus('maria'));

    await waitFor(() => {
      expect(result.current.status).toBe('cancelled');
    });
  });

  it('returns null when viewer is connected but never subscribed', async () => {
    mockUseWallet.mockReturnValue({ isConnected: true, address: 'G_FAN_123' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ active: false, indexedStatus: 'none', indexed: null }),
    });

    const { result } = renderHook(() => useViewerSubscriptionStatus('unknown_creator'));

    await waitFor(() => {
      expect(result.current.status).toBeNull();
    });
  });
});

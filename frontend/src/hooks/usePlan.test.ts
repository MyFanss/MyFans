/**
 * Unit tests for usePlan — focuses on the network-guard and
 * incomplete-params branches that gate canSign.
 *
 * Closes #1972.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock fetchPlan so we can inject any plan shape without a real API.
vi.mock('../lib/plans', () => ({
  fetchPlan: vi.fn(),
}));

// NETWORK_GUARD always reports ok=true (permissive) so that our empty-network
// tests prove the explicit network check fires independently of the guard.
vi.mock('../lib/network', () => ({
  NETWORK_GUARD: vi.fn(() => ({ ok: true, expected: 'TESTNET', actual: 'TESTNET' })),
}));

import { fetchPlan } from '../lib/plans';
import { usePlan } from './usePlan';

const mockFetchPlan = vi.mocked(fetchPlan);

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    asset: 'USDC',
    amount: '9.99',
    interval: 'monthly',
    network: 'TESTNET',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('usePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets canSign true and mismatchReason null when all params including network are present', async () => {
    mockFetchPlan.mockResolvedValueOnce(makePlan());

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canSign).toBe(true);
    expect(result.current.mismatchReason).toBeNull();
  });

  it('sets canSign false and a non-null mismatchReason when plan has an empty network string', async () => {
    mockFetchPlan.mockResolvedValueOnce(makePlan({ network: '' }));

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });

  it('sets canSign false and a non-null mismatchReason when plan has an undefined network', async () => {
    mockFetchPlan.mockResolvedValueOnce(makePlan({ network: undefined }));

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });

  it('sets canSign false when plan is null (not loaded)', async () => {
    mockFetchPlan.mockResolvedValueOnce(null);

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });

  it('sets canSign false with mismatchReason when planId is undefined', async () => {
    const { result } = renderHook(() => usePlan(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });

  it('sets canSign false when asset is missing', async () => {
    mockFetchPlan.mockResolvedValueOnce(makePlan({ asset: '' }));

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Empty network check fires first (network is present, so it's the asset check)
    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });
});

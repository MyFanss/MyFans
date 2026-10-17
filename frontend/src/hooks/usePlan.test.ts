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
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlan } from './usePlan';
import { fetchPlan } from '../lib/plans';
import { NETWORK_GUARD } from '../lib/network';

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
vi.mock('../lib/network', () => ({
  NETWORK_GUARD: vi.fn(),
}));

const mockedFetchPlan = vi.mocked(fetchPlan);
const mockedNetworkGuard = vi.mocked(NETWORK_GUARD);

const PLAN = {
  id: 'plan-1',
  asset: 'USDC',
  amount: '25',
  interval: 'monthly',
  network: 'testnet',
};

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
    mockedNetworkGuard.mockReturnValue({ ok: true });
  });

  it('is loading while fetchPlan is pending and stops after resolution', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockedFetchPlan.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }) as ReturnType<typeof fetchPlan>,
    );

    const { result } = renderHook(() => usePlan('plan-1'));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFetch(PLAN);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('populates plan and confirmParams on a successful load', async () => {
    mockedFetchPlan.mockResolvedValue(PLAN as ReturnType<typeof fetchPlan> extends Promise<infer T> ? T : never);

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });

  it('sets canSign false and a non-null mismatchReason when plan has an undefined network', async () => {
    mockFetchPlan.mockResolvedValueOnce(makePlan({ network: undefined }));
    expect(result.current.plan).toEqual(PLAN);
    expect(result.current.confirmParams).toMatchObject({
      asset: 'USDC',
      amount: '25',
      interval: 'monthly',
      network: 'testnet',
    });
    expect(result.current.canSign).toBe(true);
    expect(result.current.mismatchReason).toBeNull();
  });

  it('sets the no-longer-available error and canSign false when fetchPlan resolves falsy', async () => {
    mockedFetchPlan.mockResolvedValue(null as never);

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/no longer available/i);
    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
  });

  it('sets canSign false when plan is null (not loaded)', async () => {
    mockFetchPlan.mockResolvedValueOnce(null);
  it('sets the error message and canSign false when fetchPlan rejects', async () => {
    mockedFetchPlan.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
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
  it('sets mismatchReason from the network guard and canSign false on mismatch', async () => {
    mockedFetchPlan.mockResolvedValue(PLAN as never);
    mockedNetworkGuard.mockReturnValue({ ok: false, reason: 'Wrong network' });

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mismatchReason).toBe('Wrong network');
    expect(result.current.canSign).toBe(false);
  });

  it('refetch re-invokes fetchPlan and updates state', async () => {
    mockedFetchPlan.mockResolvedValue(PLAN as never);

    const { result } = renderHook(() => usePlan('plan-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Empty network check fires first (network is present, so it's the asset check)
    expect(result.current.canSign).toBe(false);
    expect(result.current.mismatchReason).toBeTruthy();
    expect(mockedFetchPlan).toHaveBeenCalledTimes(1);

    const updated = { ...PLAN, amount: '50' };
    mockedFetchPlan.mockResolvedValue(updated as never);

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockedFetchPlan).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.plan).toEqual(updated));
    expect(result.current.confirmParams).toMatchObject({ amount: '50' });
  });
});

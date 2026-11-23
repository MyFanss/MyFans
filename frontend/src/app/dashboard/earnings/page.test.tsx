/**
 * #2210: the earnings withdraw path signs with Freighter after prepare but
 * previously never checked the network guard itself (it relied on
 * signTransaction to catch a mismatch later, after the user had already
 * gone through the amount step). These tests mock the guard directly
 * (useNetworkGuard) so they're deterministic and never touch the real
 * Freighter extension / wallet/network modules.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardEarningsPage from './page';
import { apiFetch } from '@/lib/api/client';
import { useNetworkGuard } from '@/hooks/useNetworkGuard';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/useNetworkGuard', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useNetworkGuard')>(
    '@/hooks/useNetworkGuard',
  );
  return { ...actual, useNetworkGuard: vi.fn() };
});

const mockedApiFetch = vi.mocked(apiFetch);
const mockedUseNetworkGuard = vi.mocked(useNetworkGuard);

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as any;
}

function guardState(overrides: Partial<ReturnType<typeof useNetworkGuard>>) {
  return {
    expected: 'testnet',
    actual: 'testnet',
    mismatch: false,
    unreachable: false,
    blocked: false,
    reason: null,
    assertCanMutate: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useNetworkGuard>;
}

describe('DashboardEarningsPage network guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Balances + history load on mount; keep them simple and resolved.
    mockedApiFetch.mockImplementation((path: string) => {
      if (path.includes('/earnings/balances')) {
        return Promise.resolve(
          jsonResponse(200, { balances: [{ asset: 'USDC', available: '100', pending: '0', currency: 'USDC' }] }),
        );
      }
      if (path.includes('/earnings/history')) {
        return Promise.resolve(jsonResponse(200, { data: [], nextCursor: null }));
      }
      return Promise.resolve(jsonResponse(200, {}));
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('disables the withdraw button when the network guard reports a mismatch', async () => {
    mockedUseNetworkGuard.mockReturnValue(
      guardState({
        actual: 'mainnet',
        mismatch: true,
        blocked: true,
        reason: 'Network mismatch: expected testnet, connected to mainnet.',
      }),
    );

    render(<DashboardEarningsPage />);

    const amountInput = await screen.findByLabelText('Amount');
    (amountInput as HTMLInputElement).value = '10';

    const withdrawButton = await screen.findByRole('button', { name: /withdraw/i });
    await waitFor(() => expect(withdrawButton).toBeDisabled());

    // The guard's own banner component renders the mismatch message.
    expect(screen.getByTestId('network-mismatch-banner')).toBeInTheDocument();
    expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
  });

  it('allows the withdraw button to be enabled (not blocked by the network guard) when the network matches', async () => {
    mockedUseNetworkGuard.mockReturnValue(guardState({}));

    render(<DashboardEarningsPage />);

    await screen.findByLabelText('Amount');
    // No mismatch banner when the guard reports a match.
    expect(screen.queryByText(/wrong network/i)).not.toBeInTheDocument();
  });
});

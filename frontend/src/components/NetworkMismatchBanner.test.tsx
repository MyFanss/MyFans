/**
 * Closes #2203: `NetworkMismatchBanner` is the one shared component for the
 * "wrong network" message. These tests cover both of its call shapes:
 *
 * - Mounted at the app root with no props, driven by `useNetworkGuard()`.
 * - Driven directly by a caller's own guard result (e.g. `SubscribeConfirm`,
 *   which guards against the *loaded plan's* expected network rather than
 *   the static app default — see `networkMismatch.test.ts`).
 *
 * `SubscribeConfirm.tsx` itself still cannot be rendered in isolation here:
 * it has pre-existing, unrelated broken imports (`../../services/subscribe`
 * does not exist in this tree, and `react-router-dom` is not a dependency of
 * this package) that predate and are out of scope for this issue — the same
 * limitation already documented in `subscribe/networkMismatch.test.ts` for
 * issue #2010. This test instead exercises the shared banner with the exact
 * props `SubscribeConfirm` now passes it.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetworkMismatchBanner } from './NetworkMismatchBanner';

const mockUseNetworkGuard = vi.fn();
vi.mock('../hooks/useNetworkGuard', () => ({
  useNetworkGuard: (...args: unknown[]) => mockUseNetworkGuard(...args),
}));

describe('NetworkMismatchBanner', () => {
  it('renders nothing when the app-root guard reports a match', () => {
    mockUseNetworkGuard.mockReturnValue({
      expected: 'testnet',
      actual: 'testnet',
      mismatch: false,
      unreachable: false,
      blocked: false,
      reason: null,
    });

    render(<NetworkMismatchBanner />);

    expect(screen.queryByTestId('network-mismatch-banner')).not.toBeInTheDocument();
  });

  it('renders the shared banner text when the app-root guard reports a mismatch', () => {
    mockUseNetworkGuard.mockReturnValue({
      expected: 'testnet',
      actual: 'mainnet',
      mismatch: true,
      unreachable: false,
      blocked: true,
      reason: 'Network mismatch: expected testnet, connected to mainnet.',
    });

    render(<NetworkMismatchBanner />);

    const banner = screen.getByTestId('network-mismatch-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Wrong network.');
    expect(banner).toHaveTextContent('testnet');
    expect(banner).toHaveTextContent('mainnet');
  });

  it('renders the shared banner text when driven by a caller-supplied mismatch (SubscribeConfirm shape)', () => {
    // No stored mismatch on the app-root guard — this must not matter, since
    // expectedNetwork/actualNetwork/isMismatch fully drive the banner here.
    mockUseNetworkGuard.mockReturnValue({
      expected: 'testnet',
      actual: 'testnet',
      mismatch: false,
      unreachable: false,
      blocked: false,
      reason: null,
    });

    render(
      <NetworkMismatchBanner
        expectedNetwork="TESTNET"
        actualNetwork="PUBLIC"
        isMismatch
      />,
    );

    const banner = screen.getByTestId('network-mismatch-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Wrong network.');
    expect(banner).toHaveTextContent('TESTNET');
    expect(banner).toHaveTextContent('PUBLIC');
  });

  it('renders nothing when driven by a caller-supplied non-mismatch', () => {
    mockUseNetworkGuard.mockReturnValue({
      expected: 'testnet',
      actual: 'testnet',
      mismatch: true, // Must be ignored: expectedNetwork is provided below.
      unreachable: false,
      blocked: true,
      reason: 'ignored',
    });

    render(
      <NetworkMismatchBanner
        expectedNetwork="TESTNET"
        actualNetwork="TESTNET"
        isMismatch={false}
      />,
    );

    expect(screen.queryByTestId('network-mismatch-banner')).not.toBeInTheDocument();
  });

  it('labels a null actual network as unknown/unreachable when caller-supplied', () => {
    mockUseNetworkGuard.mockReturnValue({
      expected: 'testnet',
      actual: 'testnet',
      mismatch: false,
      unreachable: false,
      blocked: false,
      reason: null,
    });

    render(
      <NetworkMismatchBanner expectedNetwork="TESTNET" actualNetwork={null} isMismatch />,
    );

    expect(screen.getByTestId('network-mismatch-banner')).toHaveTextContent(
      'unknown / unreachable',
    );
  });
});

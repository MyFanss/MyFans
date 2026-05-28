import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NetworkMismatchBanner from '../NetworkMismatchBanner';
import type { NetworkGuardState } from '@/hooks/useNetworkGuard';

vi.mock('@/hooks/useNetworkGuard', () => ({
  useNetworkGuard: vi.fn(),
}));

import { useNetworkGuard } from '@/hooks/useNetworkGuard';

function mockGuard(overrides: Partial<NetworkGuardState>) {
  (useNetworkGuard as ReturnType<typeof vi.fn>).mockReturnValue({
    checking: false,
    mismatch: false,
    expected: 'testnet',
    detected: null,
    ...overrides,
  } satisfies NetworkGuardState);
}

describe('NetworkMismatchBanner', () => {
  it('renders children when there is no mismatch', () => {
    mockGuard({ mismatch: false });
    render(
      <NetworkMismatchBanner>
        <button>Pay</button>
      </NetworkMismatchBanner>,
    );
    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders children while still checking', () => {
    mockGuard({ checking: true, mismatch: false });
    render(
      <NetworkMismatchBanner>
        <button>Pay</button>
      </NetworkMismatchBanner>,
    );
    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
  });

  it('shows alert banner and hides children on mismatch', () => {
    mockGuard({ mismatch: true, expected: 'testnet', detected: 'PUBLIC' });
    render(
      <NetworkMismatchBanner>
        <button>Pay</button>
      </NetworkMismatchBanner>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull();
  });

  it('displays the expected and detected network names in the banner', () => {
    mockGuard({ mismatch: true, expected: 'testnet', detected: 'PUBLIC' });
    render(<NetworkMismatchBanner />);
    expect(screen.getByText(/testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/PUBLIC/i)).toBeInTheDocument();
  });

  it('has role="alert" and aria-live="assertive" for screen readers', () => {
    mockGuard({ mismatch: true, expected: 'testnet', detected: 'FUTURENET' });
    render(<NetworkMismatchBanner />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});

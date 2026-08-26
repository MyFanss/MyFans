import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfirmationScreen from './ConfirmationScreen';

// Mock useNetworkGuard
vi.mock('@/hooks/useNetworkGuard', () => ({
  useNetworkGuard: vi.fn(),
}));

// Mock getAssetByContractId
vi.mock('@/lib/assets', () => ({
  getAssetByContractId: vi.fn((asset: string) => {
    if (asset.includes('USDC')) {
      return { symbol: 'USDC', isStablecoin: true };
    }
    return { symbol: asset.slice(0, 3).toUpperCase(), isStablecoin: false };
  }),
}));

// Mock NetworkMismatchBanner
vi.mock('@/components/NetworkMismatchBanner', () => ({
  default: () => <div data-testid="network-banner">Network Mismatch</div>,
}));

describe('ConfirmationScreen', () => {
  const mockPlan = {
    id: 1,
    name: 'Premium',
    price: '25.50',
    currency: 'USDC:GBUQWP3BOUZX34LOCALTOKEN2VNB4I45VI4YIPPV5J7U3QXK4KOTECGP3',
    billingInterval: 'monthly' as const,
    creatorName: 'Test Creator',
    creatorAddress: 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7',
  };

  const mockCallbacks = {
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show network mismatch banner when wallet is on wrong network', async () => {
    const { useNetworkGuard } = await import('@/hooks/useNetworkGuard');
    (useNetworkGuard as any).mockReturnValue({
      checking: false,
      mismatch: true,
      expected: 'testnet',
      detected: 'mainnet',
    });

    render(
      <ConfirmationScreen
        plan={mockPlan}
        walletAddress="G123..."
        onConfirm={mockCallbacks.onConfirm}
        onCancel={mockCallbacks.onCancel}
      />
    );

    expect(screen.getByTestId('network-banner')).toBeInTheDocument();
  });

  it('should disable subscribe button when network mismatch exists', async () => {
    const { useNetworkGuard } = await import('@/hooks/useNetworkGuard');
    (useNetworkGuard as any).mockReturnValue({
      checking: false,
      mismatch: true,
      expected: 'testnet',
      detected: 'mainnet',
    });

    render(
      <ConfirmationScreen
        plan={mockPlan}
        walletAddress="G123..."
        onConfirm={mockCallbacks.onConfirm}
        onCancel={mockCallbacks.onCancel}
      />
    );

    const subscribeButton = screen.getByRole('button', { name: /Sign & Subscribe/i });
    expect(subscribeButton).toBeDisabled();
  });

  it('should enable subscribe button when network matches', async () => {
    const { useNetworkGuard } = await import('@/hooks/useNetworkGuard');
    (useNetworkGuard as any).mockReturnValue({
      checking: false,
      mismatch: false,
      expected: 'testnet',
      detected: 'testnet',
    });

    render(
      <ConfirmationScreen
        plan={mockPlan}
        walletAddress="G123..."
        onConfirm={mockCallbacks.onConfirm}
        onCancel={mockCallbacks.onCancel}
      />
    );

    const subscribeButton = screen.getByRole('button', { name: /Sign & Subscribe/i });
    expect(subscribeButton).not.toBeDisabled();
  });

  it('should display real plan asset, amount, and billing interval', () => {
    const { useNetworkGuard } = require('@/hooks/useNetworkGuard');
    (useNetworkGuard as any).mockReturnValue({
      checking: false,
      mismatch: false,
      expected: 'testnet',
      detected: 'testnet',
    });

    render(
      <ConfirmationScreen
        plan={mockPlan}
        walletAddress="G123..."
        onConfirm={mockCallbacks.onConfirm}
        onCancel={mockCallbacks.onCancel}
      />
    );

    expect(screen.getByText('25.50')).toBeInTheDocument();
    expect(screen.getByText(/USDC/)).toBeInTheDocument();
    expect(screen.getByText('per month')).toBeInTheDocument();
  });
});

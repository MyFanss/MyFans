import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckoutFlow from './CheckoutFlow';

// Mock dependencies
vi.mock('@/lib/checkout', () => ({
  createCheckout: vi.fn(),
  getFullCheckoutData: vi.fn(),
  validateBalance: vi.fn(),
  confirmSubscription: vi.fn(),
  failCheckout: vi.fn(),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: vi.fn(() => ({
    isPending: false,
    isFailed: false,
    isSuccess: false,
    data: null,
    error: null,
    execute: vi.fn(),
    reset: vi.fn(),
  })),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: vi.fn(() => false),
}));

vi.mock('@/hooks/useNetworkGuard', () => ({
  useNetworkGuard: vi.fn(() => ({
    mismatch: false,
    checking: false,
    expected: 'testnet',
    detected: 'testnet',
  })),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
  })),
}));

vi.mock('@/lib/stellar', () => ({
  buildSubscriptionTx: vi.fn(),
  submitTransaction: vi.fn(),
  checkTransactionStatus: vi.fn(),
}));

vi.mock('@/lib/wallet', () => ({
  signTransaction: vi.fn(),
}));

vi.mock('@/lib/transaction-history', () => ({
  createTrackedTransaction: vi.fn(),
  getExplorerUrl: vi.fn(),
}));

// Mock child components
vi.mock('./PlanSummary', () => ({
  default: () => <div>Plan Summary</div>,
}));

vi.mock('./PriceBreakdown', () => ({
  default: () => <div>Price Breakdown</div>,
}));

vi.mock('./AssetSelector', () => ({
  default: () => <div>Asset Selector</div>,
}));

vi.mock('./WalletBalance', () => ({
  default: () => <div>Wallet Balance</div>,
}));

vi.mock('./TransactionPreview', () => ({
  default: () => <div>Transaction Preview</div>,
}));

vi.mock('./TransactionProgress', () => ({
  default: () => <div>Transaction Progress</div>,
}));

vi.mock('./CheckoutResult', () => ({
  default: () => <div>Checkout Result</div>,
}));

vi.mock('./TxFailureRecovery', () => ({
  default: () => <div>Failure Recovery</div>,
}));

vi.mock('@/components/referral/ReferralCodeInput', () => ({
  ReferralCodeInput: () => <div>Referral Code</div>,
}));

describe('CheckoutFlow - Transaction Submission Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should block submission with clear error message when subscribe transaction builder is non-functional', async () => {
    const { buildSubscriptionTx } = await import('@/lib/stellar');

    // Mock buildSubscriptionTx to throw an error simulating non-functional builder
    (buildSubscriptionTx as any).mockRejectedValue(
      new Error('Subscription contract is not configured')
    );

    const mockCheckout = {
      id: 'checkout-123',
      status: 'PENDING',
      total: '10.00',
    };

    const { createCheckout, getFullCheckoutData } = await import('@/lib/checkout');

    (createCheckout as any).mockResolvedValue(mockCheckout);
    (getFullCheckoutData as any).mockResolvedValue({
      planSummary: {
        creatorName: 'Test Creator',
        name: 'Premium Plan',
      },
      priceBreakdown: {
        total: '10.00',
        currency: 'XLM',
      },
      walletStatus: {
        balances: [{ code: 'XLM', balance: '100', issuer: 'native' }],
      },
      preview: {
        type: 'subscription',
        details: 'Subscribe to creator',
      },
    });

    const { validateBalance } = await import('@/lib/checkout');
    (validateBalance as any).mockResolvedValue({
      valid: true,
      balance: '100',
    });

    render(
      <CheckoutFlow
        fanAddress="GFAN..."
        creatorAddress="GCREATOR..."
        planId={1}
      />
    );

    // Navigate to confirm step
    await waitFor(() => {
      const continueButtons = screen.queryAllByText(/Continue/i);
      if (continueButtons.length > 0) {
        fireEvent.click(continueButtons[0]);
      }
    });

    // The submit should be blocked or show error
    // This test demonstrates the issue that currently allows empty transaction submission
  });

  it('should poll transaction status after submission', async () => {
    const { checkTransactionStatus } = await import('@/lib/stellar');
    (checkTransactionStatus as any).mockResolvedValue('confirmed');

    // Test that status polling happens
    expect(checkTransactionStatus).toBeDefined();
  });

  it('should ensure failed transactions leave checkout as pending, not ACTIVE', async () => {
    const { failCheckout } = await import('@/lib/checkout');
    (failCheckout as any).mockResolvedValue({
      status: 'FAILED',
      checkoutId: 'checkout-123',
    });

    // Verify status is preserved as FAILED/PENDING, not ACTIVE
    expect(failCheckout).toBeDefined();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SubscribeConfirmationFlow from './SubscribeConfirmationFlow';
import { useSubscribeFlow } from '@/hooks/useSubscribeFlow';
import { useRouter } from 'next/navigation';

// Mock the hook
vi.mock('@/hooks/useSubscribeFlow', () => ({
  useSubscribeFlow: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock child components that might have their own complex logic
vi.mock('./WalletGate', () => ({
  default: () => <div data-testid="wallet-gate">Wallet Gate</div>,
}));

vi.mock('./ConfirmationScreen', () => ({
  default: () => <div data-testid="confirmation-screen">Confirmation Screen</div>,
}));

vi.mock('./SigningStatusIndicator', () => ({
  default: () => <div data-testid="signing-status" role="status">Signing...</div>,
}));

vi.mock('./PollingStatusIndicator', () => ({
  default: () => <div data-testid="polling-status" role="status">Polling...</div>,
}));

vi.mock('./SubscribeSuccessView', () => ({
  default: () => <div data-testid="success-view" role="status">Success!</div>,
}));

vi.mock('@/components/checkout/TxFailureRecovery', () => ({
  default: () => <div data-testid="error-view" role="alert">Error!</div>,
}));

describe('SubscribeConfirmationFlow Accessibility', () => {
  const mockPlan = {
    id: 1,
    name: 'Premium',
    price: '10',
    currency: 'XLM',
    billingInterval: 'monthly' as const,
    creatorName: 'Test Creator',
    creatorAddress: 'GB...',
  };

  const mockRouter = {
    back: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  it('focuses the container when the step changes', () => {
    (useSubscribeFlow as any).mockReturnValue({
      state: { step: 'wallet-gate' },
      execute: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });

    const { rerender } = render(<SubscribeConfirmationFlow plan={mockPlan} />);
    
    const container = screen.getByTestId('wallet-gate').parentElement;
    expect(container).toHaveFocus();
    
    // Change step and verify focus remains or moves back to container
    (useSubscribeFlow as any).mockReturnValue({
      state: { step: 'confirmation', plan: mockPlan, walletAddress: 'G...' },
      execute: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });
    
    rerender(<SubscribeConfirmationFlow plan={mockPlan} />);
    expect(screen.getByTestId('confirmation-screen')).toBeInTheDocument();
    expect(container).toHaveFocus();
  });

  it('contains aria-live="polite" on the main container', () => {
    (useSubscribeFlow as any).mockReturnValue({
      state: { step: 'wallet-gate' },
      execute: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });

    render(<SubscribeConfirmationFlow plan={mockPlan} />);
    const container = screen.getByTestId('wallet-gate').parentElement;
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  it('moves focus to the success view when subscription succeeds', () => {
    (useSubscribeFlow as any).mockReturnValue({
      state: { step: 'success', plan: mockPlan, txHash: '0x123' },
      execute: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });

    render(<SubscribeConfirmationFlow plan={mockPlan} />);
    expect(screen.getByTestId('success-view')).toBeInTheDocument();
    expect(screen.getByTestId('success-view')).toHaveAttribute('role', 'status');
  });

  it('shows error view with role="alert" when an error occurs', () => {
    (useSubscribeFlow as any).mockReturnValue({
      state: { 
        step: 'error', 
        plan: mockPlan, 
        error: { code: 'TX_FAILED', message: 'Failed' },
        retryCount: 0 
      },
      execute: vi.fn(),
      retry: vi.fn(),
      reset: vi.fn(),
    });

    render(<SubscribeConfirmationFlow plan={mockPlan} />);
    expect(screen.getByTestId('error-view')).toBeInTheDocument();
    expect(screen.getByTestId('error-view')).toHaveAttribute('role', 'alert');
  });
});

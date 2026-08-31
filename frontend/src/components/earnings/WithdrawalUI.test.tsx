import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WithdrawalUI } from './WithdrawalUI';
import * as earningsApi from '@/lib/earnings-api';
import * as walletModule from '@/hooks/useWallet';

import React from 'react';

vi.mock('@/lib/earnings-api');
vi.mock('@/hooks/useWallet');
vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: ({ onSuccess, onError }: any = {}) => {
    const [isSuccess, setIsSuccess] = React.useState(false);
    return {
      isPending: false,
      isSuccess,
      error: null,
      execute: vi.fn(async (fn) => {
        try {
          const result = await fn();
          setIsSuccess(true);
          onSuccess?.(result);
          return result;
        } catch (err) {
          onError?.(err);
        }
      }),
    };
  },
}));

describe('WithdrawalUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(walletModule.useWallet).mockReturnValue({
      connectionState: { status: 'connected', address: 'GTEST123456789', walletType: 'freighter' },
      isConnected: true,
      address: 'GTEST123456789',
      walletType: 'freighter',
      connect: vi.fn(),
      disconnect: vi.fn(),
      reconnect: vi.fn(),
      isModalOpen: false,
      openModal: vi.fn(),
      closeModal: vi.fn(),
      isWalletInstalled: vi.fn(),
      getInstallUrl: vi.fn(),
      isReconnecting: false,
      hasCheckedConnection: true,
    } as any);

    vi.mocked(earningsApi.fetchWithdrawalHistory).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
    });
  });

  it('renders withdrawal form', () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    expect(screen.getByRole('heading', { name: /request withdrawal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/withdrawal amount/i)).toBeInTheDocument();
  });

  it('requires amount input', async () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });

    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
    });
  });

  it('validates amount does not exceed available balance', async () => {
    render(<WithdrawalUI availableBalance="50.00" currency="XLM" />);
    const amountInput = screen.getByLabelText(/withdrawal amount/i);

    fireEvent.change(amountInput, { target: { value: '75.00' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/exceeds available balance/i)).toBeInTheDocument();
    });
  });

  it('requires wallet address for wallet withdrawal method', async () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    const amountInput = screen.getByLabelText(/withdrawal amount/i);

    fireEvent.change(amountInput, { target: { value: '10.00' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/wallet address is required/i)).toBeInTheDocument();
    });
  });

  it('validates Stellar address format', async () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    fireEvent.change(amountInput, { target: { value: '10.00' } });
    fireEvent.change(addressInput, { target: { value: 'INVALID' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid stellar address/i)).toBeInTheDocument();
    });
  });

  it('checks wallet connection status for wallet method', () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      isConnected: false,
      address: null,
      connectionState: { status: 'disconnected' },
    } as any);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    expect(screen.getByText(/wallet connection required/i)).toBeInTheDocument();
  });

  it('displays withdrawal history with transaction hash', async () => {
    const mockHistory = {
      items: [
        {
          id: 'w-1',
          amount: '25.00',
          currency: 'XLM',
          status: 'completed' as const,
          created_at: '2024-03-15T10:00:00Z',
          destination_address: 'GWITHDRAW123',
          tx_hash: 'abc123def456',
          fee: '1.00',
          net_amount: '24.00',
        },
      ],
      total: 1,
      page: 1,
      limit: 5,
      total_pages: 1,
    };

    vi.mocked(earningsApi.fetchWithdrawalHistory).mockResolvedValue(mockHistory);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const historyToggle = screen.getByText(/show withdrawal history/i);
    fireEvent.click(historyToggle);

    await waitFor(() => {
      expect(screen.getByText(/25.00 XLM/)).toBeInTheDocument();
      expect(screen.getByText(/completed/)).toBeInTheDocument();
    });

    // Check transaction hash is displayed and linked
    const txLink = screen.getByRole('link', { name: /abc123def456/i });
    expect(txLink).toHaveAttribute('href', expect.stringContaining('abc123def456'));
  });

  it('shows empty state when no withdrawal history', async () => {
    vi.mocked(earningsApi.fetchWithdrawalHistory).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 5,
      total_pages: 0,
    });

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const historyToggle = screen.getByText(/show withdrawal history/i);
    fireEvent.click(historyToggle);

    await waitFor(() => {
      expect(screen.getByText(/no withdrawals yet/i)).toBeInTheDocument();
    });
  });

  it('displays available balance in readonly format', () => {
    render(<WithdrawalUI availableBalance="150.50" currency="USDC" />);
    expect(screen.getByText(/150.50 USDC/)).toBeInTheDocument();
  });

  it('disables submit button when wallet not connected for wallet method', () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      isConnected: false,
      address: null,
      connectionState: { status: 'disconnected' },
    } as any);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });

    expect(submitButton).toBeDisabled();
  });

  it('allows bank transfer method without wallet connection', () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      isConnected: false,
      address: null,
      connectionState: { status: 'disconnected' },
    } as any);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const methodSelect = screen.getByLabelText(/withdrawal method/i);
    fireEvent.change(methodSelect, { target: { value: 'bank' } });

    expect(screen.queryByText(/wallet connection required/i)).not.toBeInTheDocument();
  });

  it('displays withdrawal error with error type classification', async () => {
    const mockError = new Error('API Error: 500');
    vi.mocked(earningsApi.requestWithdrawal).mockRejectedValue(mockError);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    fireEvent.change(amountInput, { target: { value: '10.00' } });
    fireEvent.change(addressInput, { target: { value: 'GTEST123456789' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/error type:/i)).toBeInTheDocument();
    });
  });

  it('blocks withdrawal when destination address does not match connected wallet (no silent mismatch)', async () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    fireEvent.change(amountInput, { target: { value: '10.00' } });
    fireEvent.change(addressInput, { target: { value: 'GDIFFERENTADDRESS1234567890' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/withdrawal address must match your connected stellar wallet/i)).toBeInTheDocument();
    });
    expect(earningsApi.requestWithdrawal).not.toHaveBeenCalled();
  });

  it('explains on-chain withdraw requirement in hint copy', () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);
    expect(screen.getByText(/on-chain payout address must match your connected stellar wallet/i)).toBeInTheDocument();
  });
});

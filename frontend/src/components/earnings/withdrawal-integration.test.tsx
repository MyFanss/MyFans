import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WithdrawalUI } from './WithdrawalUI';
import * as earningsApi from '@/lib/earnings-api';
import * as walletModule from '@/hooks/useWallet';
import React from 'react';
import type { Withdrawal } from '@/lib/earnings-api';

vi.mock('@/lib/earnings-api');
vi.mock('@/hooks/useWallet');
vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: ({ onSuccess, onError }: any = {}) => {
    const [isSuccess, setIsSuccess] = React.useState(false);
    let pendingOp: Promise<any> | null = null;
    return {
      isPending: !!pendingOp,
      isSuccess,
      error: null,
      execute: async (fn: () => Promise<any>) => {
        try {
          pendingOp = fn();
          const result = await pendingOp;
          setIsSuccess(true);
          onSuccess?.(result);
          return result;
        } catch (err) {
          onError?.(err);
          throw err;
        } finally {
          pendingOp = null;
        }
      },
    };
  },
}));

describe('Withdrawal Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(walletModule.useWallet).mockReturnValue({
      connectionState: { status: 'connected', address: 'GUSER123456789', walletType: 'freighter' },
      isConnected: true,
      address: 'GUSER123456789',
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

  it('completes full withdrawal flow: validate -> sign -> submit -> display', async () => {
    const mockWithdrawal: Withdrawal = {
      id: 'w-1',
      amount: '50.00',
      currency: 'XLM',
      status: 'pending',
      created_at: '2024-03-15T10:00:00Z',
      destination_address: 'GWITHDRAW123456',
      tx_hash: 'abc123def456ghi789',
      fee: '2.00',
      net_amount: '48.00',
    };

    vi.mocked(earningsApi.requestWithdrawal).mockResolvedValue(mockWithdrawal);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    // Step 1: Fill in the form
    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    fireEvent.change(amountInput, { target: { value: '50.00' } });
    fireEvent.change(addressInput, { target: { value: 'GUSER123456789' } });

    // Step 2: Submit the form
    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    // Step 3: Verify API call was made with correct payload
    await waitFor(() => {
      expect(earningsApi.requestWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '50.00',
          currency: 'XLM',
          destination_address: 'GUSER123456789',
          method: 'wallet',
        })
      );
    });

    // Step 4: Verify success state
    await waitFor(() => {
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });

    // Step 5: Verify form resets
    expect((amountInput as HTMLInputElement).value).toBe('');
    expect((addressInput as HTMLInputElement).value).toBe('');

    // Step 6: Verify history was reloaded
    await waitFor(() => {
      expect(earningsApi.fetchWithdrawalHistory).toHaveBeenCalled();
    });
  });

  it('handles validation errors before API call', async () => {
    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    // Try to submit with invalid data
    fireEvent.change(amountInput, { target: { value: '150.00' } }); // Exceeds available
    fireEvent.change(addressInput, { target: { value: 'INVALID' } }); // Invalid address

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    // Should show validation errors without calling API
    await waitFor(() => {
      expect(screen.getByText(/exceeds available balance/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid stellar address/i)).toBeInTheDocument();
      expect(earningsApi.requestWithdrawal).not.toHaveBeenCalled();
    });
  });

  it('requires wallet connection for wallet method', async () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      connectionState: { status: 'disconnected' },
      isConnected: false,
      address: null,
      walletType: null,
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

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    fireEvent.change(amountInput, { target: { value: '50.00' } });
    fireEvent.change(addressInput, { target: { value: 'GTEST123456789' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });

    // Should be disabled due to no wallet connection
    expect(submitButton).toBeDisabled();

    // Should show wallet connection warning
    expect(screen.getByText(/wallet connection required/i)).toBeInTheDocument();
  });

  it('displays completed withdrawal with transaction hash', async () => {
    const completedWithdrawal: Withdrawal = {
      id: 'w-1',
      amount: '50.00',
      currency: 'XLM',
      status: 'completed',
      created_at: '2024-03-15T10:00:00Z',
      completed_at: '2024-03-15T10:05:00Z',
      destination_address: 'GWITHDRAW123456',
      tx_hash: 'test1234567890abcdefghijklmnopqrst',
      fee: '2.00',
      net_amount: '48.00',
    };

    vi.mocked(earningsApi.fetchWithdrawalHistory).mockResolvedValue({
      items: [completedWithdrawal],
      total: 1,
      page: 1,
      limit: 5,
      total_pages: 1,
    });

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const historyToggle = screen.getByText(/show withdrawal history/i);
    fireEvent.click(historyToggle);

    await waitFor(() => {
      // Should display completed status
      expect(screen.getByText(/completed/)).toBeInTheDocument();

      // Should display transaction hash as a link
      const txLink = screen.getByRole('link', { name: /test1234567890ab/i });
      expect(txLink).toBeInTheDocument();

      // Link should point to Stellar explorer
      const href = txLink.getAttribute('href');
      expect(href).toContain('stellar.expert');
      expect(href).toContain('test1234567890abcdefghijklmnopqrst');
    });
  });

  it('handles withdrawal without transaction hash gracefully', async () => {
    const pendingWithdrawal: Withdrawal = {
      id: 'w-1',
      amount: '50.00',
      currency: 'XLM',
      status: 'pending',
      created_at: '2024-03-15T10:00:00Z',
      destination_address: 'GWITHDRAW123456',
      fee: '2.00',
      net_amount: '48.00',
      // No tx_hash
    };

    vi.mocked(earningsApi.fetchWithdrawalHistory).mockResolvedValue({
      items: [pendingWithdrawal],
      total: 1,
      page: 1,
      limit: 5,
      total_pages: 1,
    });

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const historyToggle = screen.getByText(/show withdrawal history/i);
    fireEvent.click(historyToggle);

    await waitFor(() => {
      // Should display pending status
      expect(screen.getByText(/pending/)).toBeInTheDocument();

      // Should still display withdrawal amount
      expect(screen.getByText(/50.00 XLM/)).toBeInTheDocument();

      // Should not crash when tx_hash is missing
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  it('requires matching wallet address for withdrawal', async () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      connectionState: { status: 'connected', address: 'GWALLET_A', walletType: 'freighter' },
      isConnected: true,
      address: 'GWALLET_A',
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

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/stellar wallet address/i);

    fireEvent.change(amountInput, { target: { value: '50.00' } });
    // Try to use a different wallet address
    fireEvent.change(addressInput, { target: { value: 'GWALLET_B' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    // Should validate that address matches connected wallet
    await waitFor(() => {
      expect(screen.getByText(/wallet address mismatch/i)).toBeInTheDocument();
      expect(earningsApi.requestWithdrawal).not.toHaveBeenCalled();
    });
  });

  it('allows bank transfer without wallet connection', async () => {
    vi.mocked(walletModule.useWallet).mockReturnValue({
      connectionState: { status: 'disconnected' },
      isConnected: false,
      address: null,
      walletType: null,
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

    const mockWithdrawal: Withdrawal = {
      id: 'w-bank-1',
      amount: '50.00',
      currency: 'XLM',
      status: 'pending',
      created_at: '2024-03-15T10:00:00Z',
      destination_address: 'US-BANK-ACCOUNT',
      fee: '5.00',
      net_amount: '45.00',
    };

    vi.mocked(earningsApi.requestWithdrawal).mockResolvedValue(mockWithdrawal);

    render(<WithdrawalUI availableBalance="100.00" currency="XLM" />);

    const methodSelect = screen.getByLabelText(/withdrawal method/i);
    fireEvent.change(methodSelect, { target: { value: 'bank' } });

    const amountInput = screen.getByLabelText(/withdrawal amount/i);
    const addressInput = screen.getByLabelText(/bank account/i);

    fireEvent.change(amountInput, { target: { value: '50.00' } });
    fireEvent.change(addressInput, { target: { value: 'US-BANK-ACCOUNT' } });

    const submitButton = screen.getByRole('button', { name: /request withdrawal/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(earningsApi.requestWithdrawal).toHaveBeenCalled();
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });
  });
});

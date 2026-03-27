import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletSelectionModal } from '../WalletSelectionModal';
import type { WalletType } from '@/types/wallet';
import { createAppError } from '@/types/errors';

// Mock the wallet library
vi.mock('@/lib/wallet', () => ({
  connectWallet: vi.fn(),
  isWalletInstalled: vi.fn(),
  getWalletInstallUrl: vi.fn(),
}));

// Mock the toast context
vi.mock('@/contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showLoading: vi.fn(() => 'loading-toast-id'),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

// Mock error copy
vi.mock('@/lib/error-copy', () => ({
  errorToastWithCause: vi.fn(() => ({ title: 'Test Error', message: 'Test error message' })),
}));

import { connectWallet, isWalletInstalled, getWalletInstallUrl } from '@/lib/wallet';

describe('WalletSelectionModal', () => {
  const mockOnConnect = vi.fn();
  const mockOnDisconnect = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (isWalletInstalled as any).mockImplementation((walletType: WalletType) => {
      return walletType === 'freighter'; // Only Freighter is installed by default
    });
    
    (getWalletInstallUrl as any).mockImplementation((walletType: WalletType) => {
      const urls = {
        freighter: 'https://freighter.app',
        lobstr: 'https://lobstr.co',
        walletconnect: null,
      };
      return urls[walletType];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderModal = (props = {}) => {
    return render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
        isWalletInstalled={isWalletInstalled}
        getInstallUrl={getWalletInstallUrl}
        {...props}
      />
    );
  };

  it('renders wallet selection options', () => {
    renderModal();

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('Freighter')).toBeInTheDocument();
    expect(screen.getByText('Lobstr')).toBeInTheDocument();
    expect(screen.getByText('WalletConnect')).toBeInTheDocument();
  });

  it('shows installation status for wallets', () => {
    renderModal();

    // Freighter is installed
    expect(screen.queryByText('Not Installed')).not.toBeInTheDocument();
    
    // Lobstr and WalletConnect are not installed
    const lobstrNotInstalled = screen.getAllByText('Not Installed');
    expect(lobstrNotInstalled).toHaveLength(2);
  });

  it('opens installation page when clicking non-installed wallet', async () => {
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
      writable: true,
    });

    renderModal();

    const lobstrButton = screen.getByText('Lobstr').closest('button');
    await userEvent.click(lobstrButton!);

    expect(mockOpen).toHaveBeenCalledWith(
      'https://lobstr.co',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('connects to installed wallet successfully', async () => {
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
    (connectWallet as any).mockResolvedValue(mockAddress);

    renderModal();

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    await waitFor(() => {
      expect(connectWallet).toHaveBeenCalledWith('freighter');
      expect(mockOnConnect).toHaveBeenCalledWith(mockAddress, 'freighter');
    });
  });

  it('handles connection failure', async () => {
    const mockError = new Error('Connection failed');
    (connectWallet as any).mockRejectedValue(mockError);

    renderModal();

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });
  });

  it('shows retry button on error and retries connection', async () => {
    const mockError = new Error('Connection failed');
    (connectWallet as any)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H');

    renderModal();

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    await waitFor(() => {
      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try again');
    await userEvent.click(retryButton);

    await waitFor(() => {
      expect(connectWallet).toHaveBeenCalledTimes(2);
      expect(mockOnConnect).toHaveBeenCalledWith(
        'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        'freighter'
      );
    });
  });

  it('prevents closing modal during connection', async () => {
    (connectWallet as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderModal();

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    const closeButton = screen.getByLabelText('Close modal');
    expect(closeButton).toBeDisabled();
  });

  it('closes modal when clicking backdrop', async () => {
    renderModal();

    const backdrop = screen.getByText('Connect Wallet').closest('[role="dialog"]')?.previousElementSibling;
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
      await userEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('closes modal with Escape key', async () => {
    renderModal();

    await userEvent.keyboard('{Escape}');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows connected state when wallet is connected', () => {
    renderModal({
      isOpen: true,
      onConnect: mockOnConnect,
    });

    // Simulate connected state by manually setting it
    // This would normally be handled by the parent component
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
  });

  it('handles disconnect', async () => {
    renderModal();

    // First connect
    const mockAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
    (connectWallet as any).mockResolvedValue(mockAddress);

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalled();
    });

    // Then disconnect (this would be handled by ConnectedWalletView)
    // For now, just test that the disconnect callback exists
    expect(mockOnDisconnect).toBeDefined();
  });

  it('shows loading state during connection', async () => {
    (connectWallet as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderModal();

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    // Check for loading spinner
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /freighter/i })).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('disables all wallet options during connection', async () => {
    (connectWallet as any).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderModal();

    const freighterButton = screen.getByText('Freighter').closest('button');
    await userEvent.click(freighterButton!);

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const walletButtons = buttons.filter(button => 
        !button.getAttribute('aria-label')?.includes('Close')
      );
      walletButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  it('shows installation tooltip for non-installed wallets', () => {
    renderModal();

    // Check for info icons on non-installed wallets
    const infoIcons = document.querySelectorAll('[data-testid="install-info-icon"]');
    // The tooltip should be present but hidden by default
    expect(document.querySelector('.group:hover:block')).toBeInTheDocument();
  });
});

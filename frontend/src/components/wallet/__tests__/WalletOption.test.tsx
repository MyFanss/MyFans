import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletOption } from '../WalletOption';
import type { WalletType } from '@/types/wallet';

describe('WalletOption', () => {
  const defaultProps = {
    type: 'freighter' as WalletType,
    name: 'Freighter',
    description: 'Browser extension wallet for Stellar',
    icon: '🚀',
    isConnecting: false,
    isInstalled: true,
    onSelect: vi.fn(),
    onInstall: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWalletOption = (props = {}) => {
    return render(<WalletOption {...defaultProps} {...props} />);
  };

  it('renders wallet information correctly', () => {
    renderWalletOption();

    expect(screen.getByText('Freighter')).toBeInTheDocument();
    expect(screen.getByText('Browser extension wallet for Stellar')).toBeInTheDocument();
    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('shows connecting state', () => {
    renderWalletOption({ isConnecting: true });

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    // Check for loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows installed state', () => {
    renderWalletOption({ isInstalled: true });

    expect(screen.queryByText('Not Installed')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('border-slate-200');
  });

  it('shows not installed state', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app' 
    });

    expect(screen.getByText('Not Installed')).toBeInTheDocument();
    expect(screen.getByText('Install Freighter to connect')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('border-amber-200');
  });

  it('calls onSelect when installed wallet is clicked', async () => {
    const mockOnSelect = vi.fn();
    renderWalletOption({ onSelect: mockOnSelect });

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(mockOnSelect).toHaveBeenCalled();
  });

  it('calls onInstall when non-installed wallet is clicked', async () => {
    const mockOnInstall = vi.fn();
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app',
      onInstall: mockOnInstall 
    });

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(mockOnInstall).toHaveBeenCalled();
  });

  it('shows install button when wallet is not installed', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app' 
    });

    // Check for install icon
    const installIcon = document.querySelector('svg[href*="M12 4v16m8-8H4"]');
    expect(installIcon).toBeInTheDocument();
  });

  it('shows installation tooltip for non-installed wallets', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app' 
    });

    // Check for info icon in tooltip
    const infoIcon = document.querySelector('svg[href*="M13 16h-1v-4h-1m1-4h.01"]');
    expect(infoIcon).toBeInTheDocument();
  });

  it('is disabled when prop is true', () => {
    renderWalletOption({ disabled: true });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:cursor-not-allowed');
  });

  it('is disabled when connecting', () => {
    renderWalletOption({ isConnecting: true });

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows correct arrow icon for installed wallets', () => {
    renderWalletOption({ isInstalled: true });

    // Check for right arrow icon
    const arrowIcon = document.querySelector('svg[href*="M9 5l7 7-7 7"]');
    expect(arrowIcon).toBeInTheDocument();
  });

  it('does not show install button when no install URL', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: undefined 
    });

    // Should show regular button state, not install state
    expect(screen.getByRole('button')).toHaveClass('border-slate-200');
  });

  it('applies correct CSS classes for dark mode', () => {
    renderWalletOption();

    const button = screen.getByRole('button');
    expect(button).toHaveClass('dark:border-slate-700');
    expect(button).toHaveClass('dark:bg-slate-900');
  });

  it('applies correct CSS classes for not installed state in dark mode', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app' 
    });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('dark:border-amber-800');
    expect(button).toHaveClass('dark:bg-amber-900/20');
  });

  it('shows wallet name with not installed badge', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app' 
    });

    const walletName = screen.getByText('Freighter');
    const badge = screen.getByText('Not Installed');
    
    expect(walletName).toBeInTheDocument();
    expect(badge).toBeInTheDocument();
    expect(walletName.parentElement).toContainElement(badge);
  });

  it('has correct accessibility attributes', () => {
    renderWalletOption({ isConnecting: true });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('handles keyboard interaction', async () => {
    const mockOnSelect = vi.fn();
    renderWalletOption({ onSelect: mockOnSelect });

    const button = screen.getByRole('button');
    button.focus();
    await userEvent.keyboard('{Enter}');

    expect(mockOnSelect).toHaveBeenCalled();
  });

  it('shows different descriptions based on installation state', () => {
    const { rerender } = renderWalletOption({ isInstalled: true });
    expect(screen.getByText('Browser extension wallet for Stellar')).toBeInTheDocument();

    rerender(<WalletOption {...defaultProps} isInstalled={false} installUrl="https://freighter.app" />);
    expect(screen.getByText('Install Freighter to connect')).toBeInTheDocument();
  });

  it('does not show tooltip when wallet is installed', () => {
    renderWalletOption({ isInstalled: true });

    // Should not have tooltip elements
    const tooltipContainer = document.querySelector('.group.relative');
    expect(tooltipContainer).not.toBeInTheDocument();
  });

  it('shows tooltip with correct text', () => {
    renderWalletOption({ 
      isInstalled: false, 
      installUrl: 'https://freighter.app' 
    });

    // Check for tooltip content
    const tooltip = document.querySelector('.group\\:hover\\:block');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Click to install Freighter wallet');
  });
});

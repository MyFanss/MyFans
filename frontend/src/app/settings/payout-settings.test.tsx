import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from './page';
import * as walletHook from '@/hooks/useWallet';

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn(),
    showWarning: vi.fn(),
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    preference: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: () => ({
    consent: { analytics: true, functional: true, marketing: false },
    setConsent: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => true,
}));

vi.mock('@/components/settings/profile-settings-panel', () => ({
  ProfileSettingsPanel: () => <div data-testid="profile-panel">Profile Panel</div>,
}));

vi.mock('@/components/wallet/WalletSelectionModal', () => ({
  WalletSelectionModal: () => null,
}));

const STELLAR_PAYOUT_ADDRESS = 'GCFX5J43S3IQN2T2C6J5P7X77WZ3HPSM2D4H4VQS5QMBL3T5OLY6T3QX';

describe('SettingsPage - Single Source Creator Payout Wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (walletHook.useWallet as any).mockReturnValue({
      isConnected: true,
      address: STELLAR_PAYOUT_ADDRESS,
      walletType: 'freighter',
      disconnect: vi.fn(),
      isModalOpen: false,
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connect: vi.fn(),
      isWalletInstalled: () => true,
      getInstallUrl: () => null,
      hasCheckedConnection: true,
    });
  });

  it('renders linked creator payout wallet in Payout Settings section', async () => {
    render(<SettingsPage />);

    // Click Payout Settings tab
    const payoutNavButton = screen.getByRole('button', { name: /payout settings/i });
    fireEvent.click(payoutNavButton);

    // Verify creator payout wallet is displayed from useWallet (single source of truth)
    expect(screen.getByTestId('wallet-settings')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-address')).toHaveTextContent('GCFX…T3QX');
    expect(screen.getByText(/creator payout wallet/i)).toBeInTheDocument();
  });

  it('explains on-chain withdrawals and settlement rules in Payout Settings', () => {
    render(<SettingsPage />);

    const payoutNavButton = screen.getByRole('button', { name: /payout settings/i });
    fireEvent.click(payoutNavButton);

    expect(screen.getByText(/on-chain withdrawals & settlement/i)).toBeInTheDocument();
    expect(
      screen.getByText(/earnings withdrawals and automated settlements are executed directly on the stellar blockchain/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/payouts are strictly restricted to your verified linked wallet/i)
    ).toBeInTheDocument();
  });

  it('displays disconnected prompt when no wallet is linked in Payout Settings', () => {
    (walletHook.useWallet as any).mockReturnValue({
      isConnected: false,
      address: null,
      walletType: null,
      disconnect: vi.fn(),
      isModalOpen: false,
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connect: vi.fn(),
      isWalletInstalled: () => true,
      getInstallUrl: () => null,
      hasCheckedConnection: true,
    });

    render(<SettingsPage />);

    const payoutNavButton = screen.getByRole('button', { name: /payout settings/i });
    fireEvent.click(payoutNavButton);

    expect(screen.getByTestId('wallet-disconnected')).toBeInTheDocument();
    expect(screen.getByText(/no stellar wallet connected/i)).toBeInTheDocument();
  });
});

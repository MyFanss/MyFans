import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  WalletSettingsPanel,
  truncateStellarAddress,
} from './WalletSettingsPanel';

const mockDisconnect = vi.fn();
const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
const mockConnect = vi.fn();

vi.mock('@/hooks/useWallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/components/wallet/WalletSelectionModal', () => ({
  WalletSelectionModal: () => null,
}));

import { useWallet } from '@/hooks/useWallet';

const STELLAR_ADDRESS =
  'GCFX5J43S3IQN2T2C6J5P7X77WZ3HPSM2D4H4VQS5QMBL3T5OLY6T3QX';

describe('truncateStellarAddress', () => {
  it('truncates long G addresses', () => {
    expect(truncateStellarAddress(STELLAR_ADDRESS)).toBe('GCFX…T3QX');
  });

  it('leaves short addresses unchanged', () => {
    expect(truncateStellarAddress('GSHORT')).toBe('GSHORT');
  });
});

describe('WalletSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows disconnect state when no wallet is connected', () => {
    (useWallet as any).mockReturnValue({
      isConnected: false,
      address: null,
      walletType: null,
      disconnect: mockDisconnect,
      isModalOpen: false,
      openModal: mockOpenModal,
      closeModal: mockCloseModal,
      connect: mockConnect,
      isWalletInstalled: () => true,
      getInstallUrl: () => null,
      hasCheckedConnection: true,
    });

    render(<WalletSettingsPanel role="creator" />);

    expect(screen.getByTestId('wallet-disconnected')).toBeInTheDocument();
    expect(screen.queryByText(/0x/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('connect-wallet'));
    expect(mockOpenModal).toHaveBeenCalled();
  });

  it('shows truncated Stellar address and copy works', async () => {
    (useWallet as any).mockReturnValue({
      isConnected: true,
      address: STELLAR_ADDRESS,
      walletType: 'freighter',
      disconnect: mockDisconnect,
      isModalOpen: false,
      openModal: mockOpenModal,
      closeModal: mockCloseModal,
      connect: mockConnect,
      isWalletInstalled: () => true,
      getInstallUrl: () => null,
      hasCheckedConnection: true,
    });

    render(<WalletSettingsPanel role="fan" />);

    const addressEl = screen.getByTestId('wallet-address');
    expect(addressEl).toHaveTextContent('GCFX…T3QX');
    expect(addressEl).not.toHaveTextContent(/0x/i);

    fireEvent.click(screen.getByTestId('copy-wallet'));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(STELLAR_ADDRESS);
    });
  });

  it('disconnects when Disconnect is clicked', () => {
    (useWallet as any).mockReturnValue({
      isConnected: true,
      address: STELLAR_ADDRESS,
      walletType: 'lobstr',
      disconnect: mockDisconnect,
      isModalOpen: false,
      openModal: mockOpenModal,
      closeModal: mockCloseModal,
      connect: mockConnect,
      isWalletInstalled: () => true,
      getInstallUrl: () => null,
      hasCheckedConnection: true,
    });

    render(<WalletSettingsPanel role="creator" />);
    fireEvent.click(screen.getByTestId('disconnect-wallet'));
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

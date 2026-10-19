import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletConnectModal from './WalletConnectModal';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

function selectWallet(value: string) {
  fireEvent.change(screen.getByLabelText('Wallet'), { target: { value } });
}

describe('WalletConnectModal', () => {
  let requestAccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestAccess = vi.fn().mockResolvedValue('G' + 'A'.repeat(55));
    (window as unknown as { freighter?: unknown }).freighter = {
      isConnected: vi.fn().mockResolvedValue(true),
      requestAccess,
      getNetwork: vi.fn().mockResolvedValue({
        network: 'TESTNET',
        networkPassphrase: NETWORK_PASSPHRASE,
      }),
      signTransaction: vi.fn(),
    };
  });

  afterEach(() => {
    delete (window as unknown as { freighter?: unknown }).freighter;
  });

  it('shows a clear unsupported-wallet message for the Lobstr path without calling requestAccess', async () => {
    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    selectWallet('lobstr');
    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/only freighter is supported/i);
    expect(alert.getAttribute('data-error-code')).toBe('unsupported');
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('clears a previously displayed error when the wallet selection changes', async () => {
    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    selectWallet('lobstr');
    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

    selectWallet('freighter');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

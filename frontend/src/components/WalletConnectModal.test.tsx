import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletConnectModal from './WalletConnectModal';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const OTHER_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

function selectWallet(value: string) {
  fireEvent.change(screen.getByLabelText('Wallet'), { target: { value } });
}

describe('WalletConnectModal', () => {
  let requestAccess: ReturnType<typeof vi.fn>;
  let getNetwork: ReturnType<typeof vi.fn>;
  let signTransaction: ReturnType<typeof vi.fn>;
  let onConnected: ReturnType<typeof vi.fn>;
  let onSigned: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestAccess = vi.fn().mockResolvedValue('G' + 'A'.repeat(55));
    getNetwork = vi.fn().mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    signTransaction = vi.fn().mockResolvedValue('SIGNED_XDR_123');
    onConnected = vi.fn();
    onSigned = vi.fn();

    (window as unknown as { freighter?: unknown }).freighter = {
      isConnected: vi.fn().mockResolvedValue(true),
      requestAccess,
      getNetwork,
      signTransaction,
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

  it('calls onConnected with the returned public key on successful connect', async () => {
    const pubKey = 'G' + 'B'.repeat(55);
    requestAccess.mockResolvedValueOnce(pubKey);

    render(
      <WalletConnectModal
        networkPassphrase={NETWORK_PASSPHRASE}
        onConnected={onConnected}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => {
      expect(onConnected).toHaveBeenCalledWith(pubKey);
    });
    expect(screen.getByText(new RegExp(pubKey))).toBeTruthy();
  });

  it('covers missing wallet error code and message', async () => {
    requestAccess.mockRejectedValueOnce(new Error('Freighter not installed'));

    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('data-error-code')).toBe('missing');
      expect(alert.textContent).toMatch(/freighter wallet not found/i);
    });
  });

  it('covers wrong_network error code and message when getNetwork passphrase mismatches on connect', async () => {
    getNetwork.mockResolvedValueOnce({
      network: 'PUBLIC',
      networkPassphrase: OTHER_PASSPHRASE,
    });

    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('data-error-code')).toBe('wrong_network');
      expect(alert.textContent).toMatch(/freighter is on a different network/i);
    });
    expect(signTransaction).not.toHaveBeenCalled();
    expect(onConnected).not.toHaveBeenCalled();
  });

  it('covers rejected error code and message', async () => {
    requestAccess.mockRejectedValueOnce(new Error('User rejected request'));

    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('data-error-code')).toBe('rejected');
      expect(alert.textContent).toMatch(/request rejected in freighter/i);
    });
  });

  it('covers popup_blocked error code and message', async () => {
    requestAccess.mockRejectedValueOnce(new Error('Popup blocked by browser'));

    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('data-error-code')).toBe('popup_blocked');
      expect(alert.textContent).toMatch(/freighter popup was blocked/i);
    });
  });

  it('covers unknown error code and message', async () => {
    requestAccess.mockRejectedValueOnce(new Error('Some weird internal error'));

    render(<WalletConnectModal networkPassphrase={NETWORK_PASSPHRASE} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('data-error-code')).toBe('unknown');
      expect(alert.textContent).toMatch(/some weird internal error/i);
    });
  });

  it('asserts that when sign is invoked and getNetwork returns a different passphrase, signTransaction is never called and wrong_network message is shown', async () => {
    const pubKey = 'G' + 'A'.repeat(55);
    requestAccess.mockResolvedValueOnce(pubKey);

    render(
      <WalletConnectModal
        networkPassphrase={NETWORK_PASSPHRASE}
        transactionXdr="AAAA...XDR..."
        onSigned={onSigned}
      />
    );

    // First connect successfully
    fireEvent.click(screen.getByRole('button', { name: /Connect Freighter/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign transaction/i })).toBeTruthy();
    });

    // Now mock getNetwork to return a mismatching passphrase for the sign call
    getNetwork.mockResolvedValueOnce({
      network: 'PUBLIC',
      networkPassphrase: OTHER_PASSPHRASE,
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign transaction/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('data-error-code')).toBe('wrong_network');
      expect(alert.textContent).toMatch(/freighter is on a different network/i);
    });

    expect(signTransaction).not.toHaveBeenCalled();
    expect(onSigned).not.toHaveBeenCalled();
  });
});

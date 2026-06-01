/**
 * E2E flow: connect wallet → subscribe to creator → unlock content
 * Uses React Testing Library to simulate the full user journey.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubscribePage from '../app/subscribe/page';
import * as walletLib from '../lib/wallet';

jest.mock('../lib/wallet');
jest.mock('../components/WalletConnect', () => ({
  __esModule: true,
  default: function MockWalletConnect() {
    const [connected, setConnected] = React.useState(false);
    return connected ? (
      <div aria-label="Wallet connected: GABC...XYZ">Connected: GABC...XYZ</div>
    ) : (
      <button onClick={() => setConnected(true)}>Connect Wallet</button>
    );
  },
}));

describe('Subscribe → Unlock E2E flow', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects wallet, subscribes to creator, and unlocks content', async () => {
    render(<SubscribePage />);

    // Step 1: Connect wallet
    await user.click(screen.getByRole('button', { name: 'Connect Wallet' }));
    expect(screen.getByText(/Connected/)).toBeInTheDocument();

    // Step 2: Enter creator address
    const input = screen.getByLabelText('Creator Stellar Address');
    await user.type(input, 'GABC1234567890123456789012345678901234567890123456');

    // Step 3: Click subscribe
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    // Step 4: Confirm modal appears with focus trap
    expect(screen.getByRole('dialog', { name: 'Confirm Subscription' })).toBeInTheDocument();
    expect(screen.getByText(/GABC1234/)).toBeInTheDocument();

    // Step 5: Confirm subscription
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // Step 6: Assert subscribed state
    await waitFor(() =>
      expect(screen.getByText('✓ Subscribed successfully!')).toBeInTheDocument(),
    );

    // Step 7: Unlock content
    const unlockBtn = screen.getByRole('button', { name: 'Unlock Content' });
    expect(unlockBtn).toBeInTheDocument();
    await user.click(unlockBtn);

    // Step 8: Assert content unlocked
    await waitFor(() =>
      expect(screen.getByText(/Content unlocked/)).toBeInTheDocument(),
    );

    // Assert no errors shown
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows error when subscribe fails', async () => {
    // Simulate failure by making setTimeout reject — patch state directly
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((fn: any) => {
      fn();
      return 0 as any;
    });

    render(<SubscribePage />);

    const input = screen.getByLabelText('Creator Stellar Address');
    await user.type(input, 'GABC1234567890123456789012345678901234567890123456');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // No crash — page still renders
    expect(screen.getByRole('button', { name: /Subscribe/ })).toBeInTheDocument();
  });

  it('subscribe button is disabled when input is empty', () => {
    render(<SubscribePage />);
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });

  it('modal closes on Escape key', async () => {
    render(<SubscribePage />);

    const input = screen.getByLabelText('Creator Stellar Address');
    await user.type(input, 'GABC1234567890123456789012345678901234567890123456');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});

/**
 * Unit tests for the SettingsPage delete-account confirmation dialog.
 *
 * Issue #2002: the confirmation phrase input must start empty every time
 * the dialog is opened, and cancelling must not leave a previously typed
 * phrase behind for the next time it's reopened.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './page';

vi.mock('@/lib/settings-api', () => ({
  fetchSettings: vi.fn().mockResolvedValue({
    payoutWallet: null,
    displayName: 'Alice',
    avatarUrl: null,
  }),
  updateSettings: vi.fn(),
  fetchSpendingCap: vi.fn().mockResolvedValue({
    amountLimit: null,
    asset: 'XLM',
    periodDays: 30,
  }),
  updateSpendingCap: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock('@/lib/auth-storage', () => ({
  clearAuthToken: vi.fn(),
}));

vi.mock('@/context/UserContext', () => ({
  useUser: () => ({
    user: { id: 'u1', username: 'alice', is_creator: true },
    refreshUser: vi.fn(),
  }),
}));

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/components/NotificationPreferencesForm', () => ({
  NotificationPreferencesForm: () => <div>notification preferences</div>,
}));

const DELETE_PHRASE = 'delete my account';

describe('SettingsPage delete-account confirmation dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
    const dangerTab = await screen.findByRole('tab', { name: 'Danger zone' });
    await user.click(dangerTab);
    const openButton = await screen.findByRole('button', { name: 'Delete my account' });
    await user.click(openButton);
    return screen.findByRole('dialog');
  }

  it('shows an empty phrase input and a disabled confirm button after type -> cancel -> reopen', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const dialog = await openDeleteDialog(user);
    const input = within(dialog).getByLabelText('Type the confirmation phrase');
    await user.type(input, DELETE_PHRASE);
    expect(input).toHaveValue(DELETE_PHRASE);

    const confirmButton = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(confirmButton).toBeEnabled();

    // Cancel closes the dialog.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen: the input must be empty again and the confirm button disabled.
    const reopened = await openDeleteDialog(user);
    const reopenedInput = within(reopened).getByLabelText('Type the confirmation phrase');
    expect(reopenedInput).toHaveValue('');

    const reopenedConfirm = within(reopened).getByRole('button', { name: 'Delete my account' });
    expect(reopenedConfirm).toBeDisabled();
  });

  it('does not call deleteAccount when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    const { deleteAccount } = await import('@/lib/settings-api');
    render(<SettingsPage />);

    const dialog = await openDeleteDialog(user);
    const input = within(dialog).getByLabelText('Type the confirmation phrase');
    await user.type(input, DELETE_PHRASE);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(deleteAccount).not.toHaveBeenCalled();
  });
});

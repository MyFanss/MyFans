import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlansPage from './page';

const createCreatorPlanOnSoroban = vi.fn();

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    connectionState: {
      status: 'connected',
      address: 'GCFX5J43S3IQN2T2C6J5P7X77WZ3HPSM2D4H4VQS5QMBL3T5OLY6T3QX',
      walletType: 'freighter',
      network: 'Stellar Testnet',
    },
    isConnected: true,
    address: 'GCFX5J43S3IQN2T2C6J5P7X77WZ3HPSM2D4H4VQS5QMBL3T5OLY6T3QX',
    walletType: 'freighter',
    connect: vi.fn(),
    disconnect: vi.fn(),
    isModalOpen: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(() => 'toast-success'),
    showError: vi.fn(() => 'toast-error'),
    showLoading: vi.fn(() => 'toast-loading'),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    toasts: [],
  }),
}));

vi.mock('@/lib/stellar', () => ({
  createCreatorPlanOnSoroban: (...args: unknown[]) => createCreatorPlanOnSoroban(...args),
}));

const VALID_CONTRACT = 'CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF';

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Studio Pass' },
  });
  fireEvent.change(screen.getByLabelText('Token contract'), {
    target: { value: VALID_CONTRACT },
  });
  fireEvent.change(screen.getByLabelText('Price'), {
    target: { value: '12.50' },
  });
}

describe('PlansPage', () => {
  beforeEach(() => {
    createCreatorPlanOnSoroban.mockReset();
    window.localStorage.clear();
  });

  it('keeps an optimistic pending plan until Soroban confirms it', async () => {
    let resolvePublish: ((value: { txHash: string; planId: number }) => void) | undefined;

    createCreatorPlanOnSoroban.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePublish = resolve;
        }),
    );

    render(<PlansPage />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Publish on Soroban' }));

    expect(await screen.findByText('Pending confirmation')).toBeInTheDocument();

    resolvePublish?.({ txHash: 'tx-hash-123', planId: 7 });

    expect(await screen.findByText('Live on Soroban')).toBeInTheDocument();
    expect(screen.getByText('tx-hash-123')).toBeInTheDocument();
  });

  it('rolls back the optimistic plan when publishing fails', async () => {
    createCreatorPlanOnSoroban.mockRejectedValue(new Error('RPC is unavailable'));

    render(<PlansPage />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Publish on Soroban' }));

    await waitFor(() => {
      expect(screen.queryByText('Pending confirmation')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No plans yet')).toBeInTheDocument();
  });
});

'use client';

import { WalletSelectionModal } from './WalletSelectionModal';
import { useWallet } from '@/hooks/useWallet';

/**
 * Demo component showing how to use the WalletSelectionModal
 */
export function WalletModalDemo() {
  const { connectionState, isModalOpen, openModal, closeModal, disconnect } = useWallet();

  const handleConnect = (address: string, walletType: string) => {
    console.log('Connected:', { address, walletType });
  };

  const handleDisconnect = () => {
    disconnect();
    console.log('Disconnected');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-lg dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Wallet Connection Demo
        </h1>

        {connectionState.status === 'connected' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Connected to {connectionState.walletType}
              </p>
              <p className="mt-1 font-mono text-xs text-green-600 dark:text-green-400">
                {connectionState.address.slice(0, 8)}...{connectionState.address.slice(-8)}
              </p>
            </div>
            <button
              onClick={openModal}
              className="w-full rounded-lg bg-primary-500 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700"
            >
              View Wallet Details
            </button>
          </div>
        ) : (
          <button
            onClick={openModal}
            className="w-full rounded-lg bg-primary-500 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700"
          >
            Connect Wallet
          </button>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            Instructions
          </h2>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <li>• Click "Connect Wallet" to open the modal</li>
            <li>• Select a wallet option (Freighter, Lobstr, or WalletConnect)</li>
            <li>• Approve the connection in your wallet</li>
            <li>• View connected state with address and network</li>
            <li>• Copy address or disconnect from the modal</li>
            <li>• Press Escape to close the modal</li>
          </ul>
        </div>
      </div>

      <WalletSelectionModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}

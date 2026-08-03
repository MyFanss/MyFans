'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { WalletSelectionModal } from '@/components/wallet/WalletSelectionModal';

export function truncateStellarAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type WalletSettingsPanelProps = {
  role: 'creator' | 'fan';
  onCopySuccess?: () => void;
  onCopyError?: () => void;
};

export function WalletSettingsPanel({
  role,
  onCopySuccess,
  onCopyError,
}: WalletSettingsPanelProps) {
  const {
    isConnected,
    address,
    walletType,
    disconnect,
    isModalOpen,
    openModal,
    closeModal,
    connect,
    hasCheckedConnection,
  } = useWallet();
  const [copied, setCopied] = useState(false);

  const walletLabel =
    role === 'creator' ? 'Creator payout wallet' : 'Fan payment wallet';
  const walletNote =
    role === 'creator'
      ? 'Payouts are sent to this Stellar wallet after each settlement cycle.'
      : 'This Stellar wallet is used for subscription renewals and one-time support payments.';

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopyError?.();
    }
  };

  return (
    <section
      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5"
      data-testid="wallet-settings"
    >
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
        Wallet
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{walletNote}</p>

      {!hasCheckedConnection ? (
        <div
          className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50"
          role="status"
          aria-label="Checking wallet connection"
        />
      ) : isConnected && address ? (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {walletLabel}
          </p>
          <p
            className="mt-1 font-mono text-sm text-slate-800 dark:text-slate-200"
            data-testid="wallet-address"
            title={address}
            aria-label={`Wallet address ${address}`}
          >
            {truncateStellarAddress(address)}
          </p>
          {walletType ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 capitalize">
              Connected via {walletType}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 transition hover:border-slate-400 dark:hover:border-slate-500 sm:w-auto"
              onClick={handleCopy}
              type="button"
              data-testid="copy-wallet"
            >
              {copied ? 'Copied' : 'Copy wallet'}
            </button>
            <button
              className="w-full rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 transition hover:border-rose-400 sm:w-auto"
              onClick={disconnect}
              type="button"
              data-testid="disconnect-wallet"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-4"
          data-testid="wallet-disconnected"
        >
          <p className="text-sm text-slate-700 dark:text-slate-300">
            No Stellar wallet connected.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Connect a Freighter or Lobstr wallet to show your G… address here.
          </p>
          <button
            className="mt-3 w-full rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 sm:w-auto"
            onClick={openModal}
            type="button"
            data-testid="connect-wallet"
          >
            Connect wallet
          </button>
        </div>
      )}

      <WalletSelectionModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConnect={(_address, walletType) => {
          void connect(walletType);
        }}
      />
    </section>
  );
}

'use client';

import { useState } from 'react';
import { WalletStatus, AssetBalance } from '@/lib/checkout';

interface AssetSelectorProps {
  walletStatus: WalletStatus;
  selectedAsset: AssetBalance | null;
  onSelectAsset: (asset: AssetBalance) => void;
}

export default function AssetSelector({ walletStatus, selectedAsset, onSelectAsset }: AssetSelectorProps) {
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
  };

  if (!walletStatus.isConnected) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-amber-800 dark:text-amber-200">
          Please connect your wallet to see available assets.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Select Payment Asset
      </h3>
      
      <div className="space-y-2">
        {walletStatus.balances.map((asset) => (
          <button
            key={`${asset.code}-${asset.issuer || 'native'}`}
            onClick={() => onSelectAsset(asset)}
            className={`flex w-full items-center justify-between rounded-lg border p-3 transition-all ${
              selectedAsset?.code === asset.code && selectedAsset?.issuer === asset.issuer
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20 dark:border-primary-400 dark:bg-primary-900/20'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {asset.code.slice(0, 2)}
                </span>
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-slate-100">{asset.code}</p>
                {asset.isNative && (
                  <p className="text-xs text-slate-500">Native Stellar Asset</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatBalance(asset.balance)}
              </p>
              {asset.isNative && (
                <p className="text-xs text-slate-500">XLM</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


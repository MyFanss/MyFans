'use client';

import { WalletStatus, AssetBalance } from '@/lib/checkout';

interface WalletBalanceProps {
  walletStatus: WalletStatus;
  selectedAsset: AssetBalance | null;
  requiredAmount?: string;
  validation?: {
    valid: boolean;
    balance: string;
    shortfall?: string;
  };
}

export default function WalletBalance({ 
  walletStatus, 
  selectedAsset, 
  requiredAmount,
  validation 
}: WalletBalanceProps) {
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!walletStatus.isConnected) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Wallet Status
        </h3>
        <p className="text-slate-500 dark:text-slate-400">No wallet connected</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Wallet Status
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">Address</span>
          <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
            {formatAddress(walletStatus.address)}
          </span>
        </div>
        
        {selectedAsset && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                {selectedAsset.code} Balance
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedAsset.balance}
              </span>
            </div>
            
            {requiredAmount && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Required</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {requiredAmount} {selectedAsset.code}
                </span>
              </div>
            )}
            
            {validation && (
              <div className={`mt-2 rounded-lg p-3 ${
                validation.valid 
                  ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                  : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
              }`}>
                {validation.valid ? (
                  <p className="text-sm text-green-700 dark:text-green-400">
                    ✓ Sufficient balance available
                  </p>
                ) : (
                  <p className="text-sm text-red-700 dark:text-red-400">
                    ✗ Insufficient balance. Shortfall: {validation.shortfall} {selectedAsset.code}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


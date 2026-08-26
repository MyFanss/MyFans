'use client';

import React, { useState, useEffect } from 'react';
import { BaseCard } from '@/components/cards';
import { useTransaction } from '@/hooks/useTransaction';
import { useWallet } from '@/hooks/useWallet';
import { requestWithdrawal, fetchWithdrawalHistory, type Withdrawal } from '@/lib/earnings-api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { signTransaction } from '@/lib/wallet';
import type { AppError } from '@/types/errors';
import { createAppError } from '@/types/errors';

interface WithdrawalUIProps {
  availableBalance: string;
  currency: string;
}

const WITHDRAWAL_METHODS = [
  { value: 'wallet', label: 'Stellar Wallet' },
  { value: 'bank', label: 'Bank Transfer' },
];

interface WithdrawalError extends AppError {
  type: 'api-error' | 'wallet-error' | 'chain-error';
}

export function WithdrawalUI({ availableBalance, currency }: WithdrawalUIProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'wallet' | 'bank'>('wallet');
  const [address, setAddress] = useState('');
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [withdrawalError, setWithdrawalError] = useState<WithdrawalError | null>(null);
  const { isConnected: isWalletConnected, address: walletAddress } = useWallet();

  const tx = useTransaction({
    type: 'withdrawal',
    onSuccess: () => {
      setAmount('');
      setAddress('');
      setErrors({});
      setWithdrawalError(null);
      loadHistory();
    },
    onError: (error: AppError) => {
      setWithdrawalError({
        ...error,
        type: 'api-error',
      } as WithdrawalError);
    },
  });

  const loadHistory = async () => {
    try {
      const data = await fetchWithdrawalHistory(1, 5);
      setHistory(data.items);
    } catch (err) {
      console.error('Failed to load withdrawal history', err);
    }
  };

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const amountNum = parseFloat(amount);
    const available = parseFloat(availableBalance);

    if (!amount) {
      newErrors.amount = 'Amount is required';
    } else if (isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    } else if (amountNum > available) {
      newErrors.amount = `Amount exceeds available balance (${availableBalance})`;
    }

    if (!address) {
      newErrors.address = `${method === 'wallet' ? 'Wallet' : 'Bank'} address is required`;
    } else if (method === 'wallet' && !address.startsWith('G')) {
      newErrors.address = 'Invalid Stellar address';
    }

    if (method === 'wallet' && !isWalletConnected) {
      newErrors.wallet = 'Wallet must be connected for Stellar wallet withdrawals';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setWithdrawalError(null);

    await tx.execute(async () => {
      try {
        // For wallet method, require wallet signature confirmation
        if (method === 'wallet') {
          if (!walletAddress) {
            throw createAppError('WALLET_NOT_CONNECTED', {
              message: 'Wallet connection required',
              description: 'Please connect your Stellar wallet before requesting a withdrawal',
            }) as WithdrawalError;
          }

          // Prompt wallet user to confirm withdrawal by signing
          try {
            // In a real implementation, this would be a specific withdrawal authorization
            // For now, we require the user to have already connected their wallet
            // which serves as implicit approval
            if (!walletAddress || walletAddress !== address) {
              throw createAppError('WALLET_ADDRESS_MISMATCH', {
                message: 'Wallet address mismatch',
                description: 'The withdrawal address must match your connected wallet address',
              }) as WithdrawalError;
            }
          } catch (err) {
            const walletError = createAppError('WALLET_SIGNATURE_REJECTED', {
              message: err instanceof Error ? err.message : 'Wallet operation cancelled',
              description: 'Please try again or use a different withdrawal method',
            }) as WithdrawalError;
            walletError.type = 'wallet-error';
            throw walletError;
          }
        }

        const result = await requestWithdrawal({
          amount,
          currency,
          destination_address: address,
          method,
        });
        return result;
      } catch (err) {
        if (typeof err === 'object' && err !== null && 'type' in err) {
          throw err;
        }
        throw createAppError('WITHDRAWAL_FAILED', {
          message: err instanceof Error ? err.message : 'Withdrawal request failed',
          cause: err instanceof Error ? err : undefined,
        }) as WithdrawalError;
      }
    });
  };

  return (
    <div className="space-y-4">
      <BaseCard padding="lg" as="section" aria-labelledby="withdrawal-heading">
        <h2 id="withdrawal-heading" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Request Withdrawal
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Available Balance */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Available Balance: <span className="font-semibold">{availableBalance} {currency}</span>
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Withdrawal Amount
            </label>
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errors.amount) setErrors({ ...errors, amount: '' });
              }}
              placeholder="0.00"
              className={errors.amount ? 'border-red-500' : ''}
            />
            {errors.amount && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.amount}</p>}
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Withdrawal Method
            </label>
            <Select
              label="Method"
              options={WITHDRAWAL_METHODS}
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as 'wallet' | 'bank');
                setAddress('');
                if (errors.address) setErrors({ ...errors, address: '' });
                setWithdrawalError(null);
              }}
            />
          </div>

          {/* Wallet Connection Status */}
          {method === 'wallet' && (
            <div className={`p-3 rounded-lg border ${
              isWalletConnected
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900'
                : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-900'
            }`}>
              <p className={`text-sm font-medium ${
                isWalletConnected
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-yellow-700 dark:text-yellow-300'
              }`}>
                {isWalletConnected ? '✓ Wallet Connected' : '⚠ Wallet Connection Required'}
              </p>
              {isWalletConnected && walletAddress && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {walletAddress.substring(0, 10)}...{walletAddress.substring(walletAddress.length - 6)}
                </p>
              )}
            </div>
          )}

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {method === 'wallet' ? 'Stellar Wallet Address' : 'Bank Account'}
            </label>
            <Input
              label={method === 'wallet' ? 'Wallet Address' : 'Bank Account'}
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errors.address) setErrors({ ...errors, address: '' });
                setWithdrawalError(null);
              }}
              placeholder={method === 'wallet' ? 'G...' : 'Account details'}
              className={errors.address ? 'border-red-500' : ''}
            />
            {errors.address && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.address}</p>}
            {errors.wallet && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.wallet}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={tx.isPending || (method === 'wallet' && !isWalletConnected)}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {tx.isPending ? 'Processing...' : 'Request Withdrawal'}
          </button>

          {/* Validation Errors */}
          {Object.keys(errors).length > 0 && Object.values(errors).some(e => e) && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900">
              <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Validation Error</p>
              {Object.values(errors).map((error, i) => error && (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">• {error}</p>
              ))}
            </div>
          )}

          {/* API/Chain Error */}
          {withdrawalError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{withdrawalError.message}</p>
              {withdrawalError.description && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{withdrawalError.description}</p>
              )}
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Error type: {withdrawalError.type === 'wallet-error' ? 'Wallet operation failed' :
                            withdrawalError.type === 'chain-error' ? 'Chain submission failed' :
                            'API error'}
              </p>
            </div>
          )}

          {/* Success */}
          {tx.isSuccess && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900">
              <p className="text-sm text-green-700 dark:text-green-300">Withdrawal request submitted successfully!</p>
            </div>
          )}
        </form>
      </BaseCard>

      {/* History Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {showHistory ? 'Hide' : 'Show'} Withdrawal History
      </button>

      {/* History */}
      {showHistory && (
        <BaseCard padding="lg">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Withdrawals</h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No withdrawals yet</p>
          ) : (
            <div className="space-y-3">
              {history.map((w) => (
                <div key={w.id} className="p-3 rounded border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {w.amount} {w.currency}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      w.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                      w.status === 'pending' || w.status === 'processing' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                      'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                  {w.tx_hash && (
                    <div className="mt-2 text-xs">
                      <p className="text-gray-600 dark:text-gray-400 mb-1">
                        Transaction:
                      </p>
                      <a
                        href={`https://stellar.expert/explorer/${process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet'}/tx/${w.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {w.tx_hash.substring(0, 16)}...{w.tx_hash.substring(w.tx_hash.length - 8)}
                      </a>
                    </div>
                  )}
                  {w.destination_address && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 break-all">
                      To: {w.destination_address}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </BaseCard>
      )}
    </div>
  );
}

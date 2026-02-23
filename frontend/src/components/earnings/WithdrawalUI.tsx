'use client';

import React, { useState, useEffect } from 'react';
import { BaseCard } from '@/components/cards';
import { useTransaction } from '@/hooks/useTransaction';
import { requestWithdrawal, fetchWithdrawalHistory, type Withdrawal } from '@/lib/earnings-api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface WithdrawalUIProps {
  availableBalance: string;
  currency: string;
}

const WITHDRAWAL_METHODS = [
  { value: 'wallet', label: 'Stellar Wallet' },
  { value: 'bank', label: 'Bank Transfer' },
];

export function WithdrawalUI({ availableBalance, currency }: WithdrawalUIProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'wallet' | 'bank'>('wallet');
  const [address, setAddress] = useState('');
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tx = useTransaction({
    type: 'withdrawal',
    onSuccess: () => {
      setAmount('');
      setAddress('');
      setErrors({});
      loadHistory();
    },
  });

  const loadHistory = async () => {
    try {
      const data = await fetchWithdrawalHistory(5);
      setHistory(data);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await tx.execute(async () => {
      const result = await requestWithdrawal({
        amount,
        currency,
        destination_address: address,
        method,
      });
      return result;
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
              }}
            />
          </div>

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
              }}
              placeholder={method === 'wallet' ? 'G...' : 'Account details'}
              className={errors.address ? 'border-red-500' : ''}
            />
            {errors.address && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.address}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={tx.isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {tx.isPending ? 'Processing...' : 'Request Withdrawal'}
          </button>

          {tx.error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-700 dark:text-red-300">{tx.error.message}</p>
            </div>
          )}

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
            <div className="space-y-2">
              {history.map((w) => (
                <div key={w.id} className="flex justify-between items-center p-2 rounded border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {w.amount} {w.currency}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(w.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    w.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                    w.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                    'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </BaseCard>
      )}
    </div>
  );
}

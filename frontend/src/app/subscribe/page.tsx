'use client';

import { useState, useCallback } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { useTransaction } from '@/hooks/useTransaction';
import { useFormValidation, validationPatterns } from '@/hooks/useFormValidation';
import { useToast } from '@/components/ErrorToast';
import { ErrorFallbackCompact } from '@/components/ErrorFallback';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function SubscribePage() {
  const { showError, showSuccess } = useToast();

  // Form validation
  const form = useFormValidation({
    initialValues: {
      creator: '',
      amount: '',
    },
    fields: {
      creator: {
        required: true,
        pattern: validationPatterns.stellarAddress,
        patternMessage: 'Please enter a valid Stellar address (starts with G)',
      },
      amount: {
        required: true,
        customValidator: (value) => {
          const num = Number(value);
          if (isNaN(num) || num <= 0) {
            return 'Please enter a valid amount';
          }
          return null;
        },
      },
    },
  });

  // Transaction handling
  const tx = useTransaction({
    type: 'subscription',
    onSuccess: () => {
      showSuccess('Subscription successful!', 'You are now subscribed to this creator.');
      form.reset();
    },
    onError: (error) => {
      showError(error);
    },
  });

  const handleSubscribe = useCallback(async () => {
    if (!form.validateAll()) {
      return;
    }

    await tx.execute(async () => {
      // Simulate subscription API call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate success (in real app, this would be an API call)
          const shouldFail = Math.random() < 0.2; // 20% chance of failure for demo
          if (shouldFail) {
            reject(new Error('Transaction rejected by user'));
          } else {
            resolve({ success: true });
          }
        }, 1500);
      });
      return { success: true };
    });
  }, [form, tx]);

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-slate-900">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Subscribe to Creators
        </h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <WalletConnect />
        </div>
      </header>

      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-xl text-slate-700 dark:text-slate-300">
          Find a Creator
        </h2>

        <div className="space-y-4">
          {/* Creator Address Input */}
          <div>
            <label
              htmlFor="creator"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Creator Stellar Address
            </label>
            <input
              id="creator"
              name="creator"
              type="text"
              placeholder="G..."
              value={form.values.creator}
              onChange={form.handleChange}
              onBlur={() => form.handleBlur('creator')}
              className={`w-full rounded-lg border px-4 py-3 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                form.hasFieldError('creator')
                  ? 'border-red-300 focus:border-red-500 dark:border-red-700'
                  : 'border-slate-300 focus:border-primary-500 dark:border-slate-600'
              }`}
            />
            {form.getError('creator') && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                {form.getError('creator')}
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label
              htmlFor="amount"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Amount (XLM)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              placeholder="0.00"
              value={form.values.amount}
              onChange={form.handleChange}
              onBlur={() => form.handleBlur('amount')}
              className={`w-full rounded-lg border px-4 py-3 text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                form.hasFieldError('amount')
                  ? 'border-red-300 focus:border-red-500 dark:border-red-700'
                  : 'border-slate-300 focus:border-primary-500 dark:border-slate-600'
              }`}
            />
            {form.getError('amount') && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                {form.getError('amount')}
              </p>
            )}
          </div>

          {/* Transaction Error */}
          {tx.error && (
            <ErrorFallbackCompact
              error={tx.error}
              onReset={tx.reset}
              resetLabel="Clear"
            />
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubscribe}
            disabled={tx.isPending || !form.values.creator || !form.values.amount}
            className="w-full rounded-lg bg-primary-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
          >
            {tx.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              'Subscribe'
            )}
          </button>

          {/* Retry Button (shown on failure) */}
          {tx.isFailed && tx.error?.recoverable && (
            <button
              onClick={tx.retry}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

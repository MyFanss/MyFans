'use client';

import { useState } from 'react';

interface ReferralCodeInputProps {
  onValidated?: (code: string, valid: boolean) => void;
  className?: string;
}

export function ReferralCodeInput({ onValidated, className = '' }: ReferralCodeInputProps) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [message, setMessage] = useState('');

  async function handleApply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setStatus('checking');
    setMessage('');

    try {
      const res = await fetch('/api/v1/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json() as { valid: boolean; reason?: string };

      if (data.valid) {
        setStatus('valid');
        setMessage('Code applied!');
        onValidated?.(trimmed, true);
      } else {
        setStatus('invalid');
        setMessage(data.reason ?? 'Invalid code');
        onValidated?.(trimmed, false);
      }
    } catch {
      setStatus('invalid');
      setMessage('Could not validate code. Try again.');
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor="referral-code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Referral / invite code <span className="text-gray-400">(optional)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="referral-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setStatus('idle');
            setMessage('');
          }}
          placeholder="e.g. ALICE1234"
          maxLength={20}
          aria-describedby="referral-code-status"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={!code.trim() || status === 'checking'}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'checking' ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {message && (
        <p
          id="referral-code-status"
          role="status"
          className={`text-xs ${status === 'valid' ? 'text-green-600' : 'text-red-500'}`}
        >
          {status === 'valid' ? '✓ ' : '✗ '}{message}
        </p>
      )}
    </div>
  );
}

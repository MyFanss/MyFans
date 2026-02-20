'use client';

import { useState, useEffect } from 'react';
import { PendingStatus, type PendingState } from '@/components/pending';

export function PendingStatusClient() {
  const [state, setState] = useState<PendingState>('pending');
  const [countdown, setCountdown] = useState(15);
  const [isLoading, setIsLoading] = useState(true);

  // Mock transaction hash
  const mockTxHash = '7a8f3e2b1c9d4a5e6f7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0';

  useEffect(() => {
    // Simulate initial loading
    const loadTimer = setTimeout(() => setIsLoading(false), 500);

    // Simulate countdown
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Simulate state transitions: pending → processing → success
    const processingTimer = setTimeout(() => setState('processing'), 5000);
    const successTimer = setTimeout(() => setState('success'), 10000);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(processingTimer);
      clearTimeout(successTimer);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleRetry = () => {
    setState('pending');
    setCountdown(15);
  };

  const handleContinue = () => {
    window.location.href = '/subscriptions';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <PendingStatus
        state={state}
        transactionHash={mockTxHash}
        countdown={countdown > 0 ? countdown : undefined}
        onRetry={handleRetry}
        onContinue={handleContinue}
      />
    </div>
  );
}

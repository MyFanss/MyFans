'use client';

import { useState, useEffect, useCallback } from 'react';
import { PendingStatus, type PendingState } from '@/components/pending';

const MOCK_TX_HASH = '7a8f3e2b1c9d4a5e6f7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0';
const INITIAL_COUNTDOWN = 15;
const LOADING_DELAY = 500;
const PROCESSING_DELAY = 5000;
const SUCCESS_DELAY = 10000;

export function PendingStatusClient() {
  const [state, setState] = useState<PendingState>('pending');
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTimer = setTimeout(() => setIsLoading(false), LOADING_DELAY);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    const processingTimer = setTimeout(() => setState('processing'), PROCESSING_DELAY);
    const successTimer = setTimeout(() => setState('success'), SUCCESS_DELAY);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(processingTimer);
      clearTimeout(successTimer);
      clearInterval(countdownInterval);
    };
  }, []);

  const handleRetry = useCallback(() => {
    setState('pending');
    setCountdown(INITIAL_COUNTDOWN);
  }, []);

  const handleContinue = useCallback(() => {
    window.location.href = '/subscriptions';
  }, []);

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
        transactionHash={MOCK_TX_HASH}
        countdown={countdown > 0 ? countdown : undefined}
        onRetry={handleRetry}
        onContinue={handleContinue}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { checkTransactionStatus } from '@/lib/stellar';
import type { TxPollStatus, TransactionPollResult } from '@/types/subscribe';

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

export function useTransactionPoller(
  txHash: string | null
): TransactionPollResult & { isPolling: boolean } {
  const [status, setStatus] = useState<TxPollStatus>('pending');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!txHash) {
      setStatus('pending');
      setElapsedMs(0);
      setIsPolling(false);
      return;
    }

    setStatus('pending');
    setElapsedMs(0);
    setIsPolling(true);

    const startTime = Date.now();

    const interval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(elapsed);

      if (elapsed >= TIMEOUT_MS) {
        setStatus('timeout');
        setIsPolling(false);
        clearInterval(interval);
        return;
      }

      const result = await checkTransactionStatus(txHash);
      if (result === 'confirmed' || result === 'failed') {
        setStatus(result);
        setIsPolling(false);
        clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [txHash]);

  return {
    status,
    txHash: txHash ?? '',
    elapsedMs,
    isPolling,
  };
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FlowState, SubscriptionPlan } from '@/types/subscribe';
import type { AppError } from '@/types/errors';
import { createAppError } from '@/types/errors';
import { buildSubscriptionTx, submitTransaction } from '@/lib/stellar';
import { signTransaction } from '@/lib/wallet';
import { useTransactionPoller } from './useTransactionPoller';

const MAX_AUTO_RETRIES = 3;
const NETWORK_ERROR_CODES = new Set(['NETWORK_ERROR', 'TX_SUBMIT_FAILED', 'RPC_ERROR']);

function isNetworkClassError(error: AppError): boolean {
  return NETWORK_ERROR_CODES.has(error.code);
}

export function useSubscribeFlow(plan: SubscriptionPlan | null) {
  const [state, setState] = useState<FlowState>({ step: 'wallet-gate' });
  const walletAddressRef = useRef<string>('');
  const retryCountRef = useRef<number>(0);

  // Derive txHash for poller
  const txHash = state.step === 'polling' ? state.txHash : null;
  const poller = useTransactionPoller(txHash);

  // Watch poller status and transition accordingly
  useEffect(() => {
    if (state.step !== 'polling') return;

    if (poller.status === 'confirmed') {
      setState({
        step: 'success',
        plan: state.plan,
        txHash: state.txHash,
      });
    } else if (poller.status === 'failed' || poller.status === 'timeout') {
      const errorCode = poller.status === 'timeout' ? 'TX_TIMEOUT' : 'TX_FAILED';
      setState({
        step: 'error',
        plan: state.plan,
        error: createAppError(errorCode),
        retryCount: retryCountRef.current,
      });
    }
  }, [poller.status, state]);

  const executeWithRetry = useCallback(
    async (walletAddress: string, currentRetryCount: number) => {
      if (!plan) return;

      // Step 1: awaiting-signature
      setState({ step: 'awaiting-signature', plan, walletAddress });

      // Step 2: build transaction
      let xdr: string;
      try {
        xdr = await buildSubscriptionTx(
          walletAddress,
          plan.creatorAddress,
          plan.id,
          plan.currency
        );
      } catch (err) {
        const appError = err as AppError;
        setState({
          step: 'error',
          plan,
          error: appError.code
            ? appError
            : createAppError('TX_BUILD_FAILED', {
                message: err instanceof Error ? err.message : 'Failed to build transaction',
              }),
          retryCount: currentRetryCount,
        });
        return;
      }

      // Step 3: sign transaction
      let signedXdr: string;
      try {
        signedXdr = await signTransaction(xdr);
      } catch (err) {
        const appError = err as AppError;
        setState({
          step: 'error',
          plan,
          error: appError.code
            ? appError
            : createAppError('WALLET_SIGNATURE_FAILED', {
                message: err instanceof Error ? err.message : 'Failed to sign transaction',
              }),
          retryCount: currentRetryCount,
        });
        return;
      }

      // Step 4: submitting
      setState({ step: 'submitting', plan, signedXdr });

      // Step 5: submit with auto-retry for network-class errors
      let txHash: string;
      let submitRetry = currentRetryCount;
      while (true) {
        try {
          txHash = await submitTransaction(signedXdr);
          break;
        } catch (err) {
          const appError = err as AppError;
          const isNetworkErr = appError.code
            ? isNetworkClassError(appError)
            : false;

          if (isNetworkErr && submitRetry < MAX_AUTO_RETRIES) {
            submitRetry++;
            retryCountRef.current = submitRetry;
            // brief pause before retry
            await new Promise((r) => setTimeout(r, 1000 * submitRetry));
            continue;
          }

          setState({
            step: 'error',
            plan,
            error: appError.code
              ? appError
              : createAppError('TX_SUBMIT_FAILED', {
                  message: err instanceof Error ? err.message : 'Failed to submit transaction',
                }),
            retryCount: submitRetry,
          });
          return;
        }
      }

      // Step 6: polling
      setState({ step: 'polling', plan, txHash });
    },
    [plan]
  );

  const execute = useCallback(
    async (walletAddress: string) => {
      if (!plan) return;
      walletAddressRef.current = walletAddress;
      retryCountRef.current = 0;
      await executeWithRetry(walletAddress, 0);
    },
    [plan, executeWithRetry]
  );

  const retry = useCallback(() => {
    if (state.step !== 'error') return;
    const walletAddress = walletAddressRef.current;
    if (!walletAddress || !plan) return;
    const currentRetry = retryCountRef.current;
    executeWithRetry(walletAddress, currentRetry);
  }, [state, plan, executeWithRetry]);

  const reset = useCallback(() => {
    retryCountRef.current = 0;
    walletAddressRef.current = '';
    setState({ step: 'wallet-gate' });
  }, []);

  return { state, execute, retry, reset };
}

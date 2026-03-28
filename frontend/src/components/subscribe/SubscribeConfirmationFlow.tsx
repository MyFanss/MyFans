'use client';

import { useRouter } from 'next/navigation';
import { useSubscribeFlow } from '@/hooks/useSubscribeFlow';
import type { SubscriptionPlan } from '@/types/subscribe';
import WalletGate from './WalletGate';
import ConfirmationScreen from './ConfirmationScreen';
import SigningStatusIndicator from './SigningStatusIndicator';
import PollingStatusIndicator from './PollingStatusIndicator';
import SubscribeSuccessView from './SubscribeSuccessView';
import TxFailureRecovery from '@/components/checkout/TxFailureRecovery';

interface SubscribeConfirmationFlowProps {
  plan: SubscriptionPlan;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SubscribeConfirmationFlow({
  plan,
  onSuccess,
  onCancel,
}: SubscribeConfirmationFlowProps) {
  const router = useRouter();
  const { state, execute, retry, reset } = useSubscribeFlow(plan);

  function renderStep() {
    switch (state.step) {
      case 'wallet-gate':
        return <WalletGate onConnected={(addr) => execute(addr)} />;

      case 'confirmation':
        return (
          <ConfirmationScreen
            plan={state.plan}
            walletAddress={state.walletAddress}
            onConfirm={() => execute(state.walletAddress)}
            onCancel={onCancel ?? (() => router.back())}
            disabled={false}
          />
        );

      case 'awaiting-signature':
        return <SigningStatusIndicator />;

      case 'submitting':
        return <PollingStatusIndicator />;

      case 'polling':
        return <PollingStatusIndicator />;

      case 'success':
        return (
          <SubscribeSuccessView
            plan={state.plan}
            txHash={state.txHash}
            onViewContent={onSuccess ?? (() => router.back())}
          />
        );

      case 'error':
        return (
          <TxFailureRecovery
            error={state.error}
            onRetry={retry}
            onDismiss={reset}
            retryCount={state.retryCount}
            maxRetries={3}
          />
        );
    }
  }

  return <div className="max-w-md mx-auto p-4">{renderStep()}</div>;
}

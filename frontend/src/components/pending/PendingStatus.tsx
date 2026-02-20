import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import Button from '@/components/Button';

export type PendingState = 'pending' | 'processing' | 'success' | 'error';

export interface PendingStatusProps {
  state: PendingState;
  transactionHash?: string;
  message?: string;
  countdown?: number;
  onRetry?: () => void;
  onContinue?: () => void;
}

export function PendingStatus({
  state,
  transactionHash,
  message,
  countdown,
  onRetry,
  onContinue,
}: PendingStatusProps) {
  const stateConfig = {
    pending: {
      icon: Clock,
      title: 'Transaction Pending',
      status: 'pending' as const,
      description: 'Your transaction is being processed on the Stellar network...',
    },
    processing: {
      icon: Clock,
      title: 'Processing Subscription',
      status: 'info' as const,
      description: 'Setting up your subscription access...',
    },
    success: {
      icon: CheckCircle2,
      title: 'Subscription Active',
      status: 'success' as const,
      description: 'Your subscription has been successfully activated!',
    },
    error: {
      icon: AlertCircle,
      title: 'Transaction Failed',
      status: 'error' as const,
      description: 'There was an issue processing your transaction.',
    },
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="card-base border rounded-lg p-8 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`p-4 rounded-full ${
            state === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
            state === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
            'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            <Icon className={`w-12 h-12 ${
              state === 'success' ? 'text-green-600 dark:text-green-400' :
              state === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-blue-600 dark:text-blue-400'
            } ${state === 'pending' || state === 'processing' ? 'animate-pulse' : ''}`} />
          </div>
        </div>

        {/* Title & Status */}
        <h1 className="text-2xl font-bold mb-2">{config.title}</h1>
        <div className="flex justify-center mb-4">
          <StatusIndicator status={config.status} label={config.status} />
        </div>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message || config.description}
        </p>

        {/* Transaction Hash */}
        {transactionHash && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Transaction Hash</p>
            <code className="text-xs break-all text-gray-700 dark:text-gray-300">
              {transactionHash}
            </code>
          </div>
        )}

        {/* Countdown */}
        {countdown !== undefined && countdown > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estimated time remaining: <span className="font-semibold">{countdown}s</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          {state === 'error' && onRetry && (
            <Button onClick={onRetry} variant="primary">
              Retry Transaction
            </Button>
          )}
          {state === 'success' && onContinue && (
            <Button onClick={onContinue} variant="primary">
              Continue
            </Button>
          )}
          {(state === 'pending' || state === 'processing') && (
            <Button disabled variant="secondary">
              Please Wait...
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

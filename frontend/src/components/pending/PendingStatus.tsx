import { Clock, CheckCircle2, AlertCircle, type LucideIcon } from 'lucide-react';
import { StatusIndicator, type StatusType } from '@/components/ui/StatusIndicator';
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

interface StateConfig {
  icon: LucideIcon;
  title: string;
  status: StatusType;
  description: string;
  bgColor: string;
  iconColor: string;
}

const STATE_CONFIG: Record<PendingState, StateConfig> = {
  pending: {
    icon: Clock,
    title: 'Transaction Pending',
    status: 'pending',
    description: 'Your transaction is being processed on the Stellar network...',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  processing: {
    icon: Clock,
    title: 'Processing Subscription',
    status: 'info',
    description: 'Setting up your subscription access...',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    icon: CheckCircle2,
    title: 'Subscription Active',
    status: 'success',
    description: 'Your subscription has been successfully activated!',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: AlertCircle,
    title: 'Transaction Failed',
    status: 'error',
    description: 'There was an issue processing your transaction.',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

export function PendingStatus({
  state,
  transactionHash,
  message,
  countdown,
  onRetry,
  onContinue,
}: PendingStatusProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  const shouldAnimate = state === 'pending' || state === 'processing';

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="card-base border rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className={`p-4 rounded-full ${config.bgColor}`}>
            <Icon className={`w-12 h-12 ${config.iconColor} ${shouldAnimate ? 'animate-pulse' : ''}`} />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">{config.title}</h1>
        <div className="flex justify-center mb-4">
          <StatusIndicator status={config.status} label={config.status} />
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message || config.description}
        </p>

        {transactionHash && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Transaction Hash</p>
            <code className="text-xs break-all text-gray-700 dark:text-gray-300">
              {transactionHash}
            </code>
          </div>
        )}

        {countdown !== undefined && countdown > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estimated time remaining: <span className="font-semibold">{countdown}s</span>
            </p>
          </div>
        )}

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
          {shouldAnimate && (
            <Button disabled variant="secondary">
              Please Wait...
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

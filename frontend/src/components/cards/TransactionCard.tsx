import React from 'react';
import { BaseCard, BaseCardProps } from './BaseCard';

export type TransactionType = 'subscription' | 'tip' | 'purchase' | 'withdrawal' | 'refund' | 'payout';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled';

export interface TransactionCardProps extends Omit<BaseCardProps, 'children'> {
  /**
   * Transaction ID
   */
  transactionId: string;
  /**
   * Transaction type
   */
  type: TransactionType;
  /**
   * Transaction amount
   */
  amount: number;
  /**
   * Currency code (default: USD)
   */
  currency?: string;
  /**
   * Transaction status
   */
  status: TransactionStatus;
  /**
   * Transaction date
   */
  date: Date | string;
  /**
   * Counterparty name (creator or subscriber)
   */
  counterpartyName?: string;
  /**
   * Counterparty avatar URL
   */
  counterpartyAvatar?: string;
  /**
   * Description or memo
   */
  description?: string;
  /**
   * Payment method info
   */
  paymentMethod?: string;
  /**
   * Whether this is an incoming transaction (credit)
   */
  isIncoming?: boolean;
  /**
   * Click handler to view transaction details
   */
  onViewDetails?: () => void;
}

/**
 * TransactionCard - Displays transaction/payment information
 * 
 * Used for transaction history, payment records, and financial
 * management interfaces.
 * 
 * @example
 * ```tsx
 * <TransactionCard
 *   transactionId="txn_123456"
 *   type="subscription"
 *   amount={19.99}
 *   status="completed"
 *   date={new Date()}
 *   counterpartyName="Jane Doe"
 *   isIncoming
 * />
 * ```
 */
export const TransactionCard: React.FC<TransactionCardProps> = ({
  transactionId,
  type,
  amount,
  currency = 'USD',
  status,
  date,
  counterpartyName,
  // counterpartyAvatar: _counterpartyAvatar,
  description,
  paymentMethod,
  isIncoming = false,
  onViewDetails,
  className = '',
  ...baseProps
}) => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  const formatDate = (d: Date | string): string => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (d: Date | string): string => {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeInfo = (): { label: string; icon: React.ReactNode; color: string } => {
    switch (type) {
      case 'subscription':
        return {
          label: 'Subscription',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
          ),
          color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
        };
      case 'tip':
        return {
          label: 'Tip',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
        };
      case 'purchase':
        return {
          label: 'Purchase',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
          ),
          color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
        };
      case 'withdrawal':
        return {
          label: 'Withdrawal',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 4.414l-4.293 4.293a1 1 0 01-1.414 0L4 7.414 5.414 6l3.293 3.293L13 5l1 2.414z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
        };
      case 'refund':
        return {
          label: 'Refund',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          ),
          color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
        };
      case 'payout':
        return {
          label: 'Payout',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          ),
          color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
        };
      default:
        return {
          label: 'Transaction',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          ),
          color: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
        };
    }
  };

  const getStatusStyles = (): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const typeInfo = getTypeInfo();

  return (
    <BaseCard
      className={`${className}`}
      padding="md"
      interactive={!!onViewDetails}
      onClick={onViewDetails}
      {...baseProps}
    >
      <div className="flex items-start gap-4">
        {/* Type icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${typeInfo.color}`}>
          {typeInfo.icon}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {typeInfo.label}
              </h4>
              {counterpartyName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isIncoming ? 'From' : 'To'}: {counterpartyName}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className={`text-lg font-semibold ${isIncoming ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                {isIncoming ? '+' : '-'}{formatCurrency(amount)}
              </p>
            </div>
          </div>

          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyles()}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              {paymentMethod && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {paymentMethod}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {formatDate(date)} • {formatTime(date)}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction ID (shown on hover for details) */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
          ID: {transactionId}
        </p>
      </div>
    </BaseCard>
  );
};

export default TransactionCard;

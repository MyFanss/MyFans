import React from 'react';
import { BaseCard, BaseCardProps } from './BaseCard';

export type MetricTrend = 'up' | 'down' | 'neutral';

export interface MetricCardProps extends Omit<BaseCardProps, 'children'> {
  /**
   * Metric title/label
   */
  title: string;
  /**
   * Main metric value
   */
  value: string | number;
  /**
   * Optional prefix for the value (e.g., '$')
   */
  valuePrefix?: string;
  /**
   * Optional suffix for the value (e.g., '%')
   */
  valueSuffix?: string;
  /**
   * Previous value for comparison
   */
  previousValue?: string | number;
  /**
   * Percentage change from previous period
   */
  changePercent?: number;
  /**
   * Trend direction
   */
  trend?: MetricTrend;
  /**
   * Comparison period label (e.g., 'vs last month')
   */
  comparisonLabel?: string;
  /**
   * Icon to display
   */
  icon?: React.ReactNode;
  /**
   * Custom chart or visualization
   */
  chart?: React.ReactNode;
  /**
   * Whether higher values are better (affects trend color)
   */
  higherIsBetter?: boolean;
  /**
   * Loading state
   */
  isLoading?: boolean;
  /**
   * Subtitle or additional context
   */
  subtitle?: string;
}

/**
 * MetricCard - Displays key performance metrics and statistics
 * 
 * Used for dashboards, analytics views, and overview pages
 * to show important numbers and trends.
 * 
 * @example
 * ```tsx
 * <MetricCard
 *   title="Total Revenue"
 *   value={12500}
 *   valuePrefix="$"
 *   changePercent={12.5}
 *   trend="up"
 *   comparisonLabel="vs last month"
 *   icon={<DollarIcon />}
 * />
 * ```
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  valuePrefix = '',
  valueSuffix = '',
  previousValue,
  changePercent,
  trend = 'neutral',
  comparisonLabel,
  icon,
  chart,
  higherIsBetter = true,
  isLoading = false,
  subtitle,
  className = '',
  ...baseProps
}) => {
  const getTrendColor = (): string => {
    if (trend === 'neutral') {
      return 'text-gray-500 dark:text-gray-400';
    }
    
    const isPositive = trend === 'up';
    const isGood = higherIsBetter ? isPositive : !isPositive;
    
    return isGood
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  };

  const getTrendIcon = () => {
    if (trend === 'neutral') {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    
    if (trend === 'up') {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <BaseCard
      className={`flex flex-col ${className}`}
      padding="lg"
      {...baseProps}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      {isLoading ? (
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
      ) : (
        <div className="flex items-baseline gap-1 mb-2">
          {valuePrefix && (
            <span className="text-lg text-gray-600 dark:text-gray-300">
              {valuePrefix}
            </span>
          )}
          <span className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatValue(value)}
          </span>
          {valueSuffix && (
            <span className="text-lg text-gray-600 dark:text-gray-300">
              {valueSuffix}
            </span>
          )}
        </div>
      )}

      {/* Change indicator */}
      {(changePercent !== undefined || previousValue !== undefined) && (
        <div className="flex items-center gap-2 mb-3">
          {changePercent !== undefined && !isLoading && (
            <div className={`flex items-center gap-1 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-sm font-medium">
                {Math.abs(changePercent).toFixed(1)}%
              </span>
            </div>
          )}
          {comparisonLabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {comparisonLabel}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      {chart && (
        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
          {chart}
        </div>
      )}
    </BaseCard>
  );
};

export default MetricCard;

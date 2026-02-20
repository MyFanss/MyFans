import React from 'react';
import { BaseCard, BaseCardProps } from './BaseCard';

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanCardProps extends Omit<BaseCardProps, 'children'> {
  /**
   * Plan name (e.g., "Basic", "Pro", "Premium")
   */
  name: string;
  /**
   * Monthly price
   */
  price: number;
  /**
   * Billing period (default: month)
   */
  billingPeriod?: 'month' | 'year';
  /**
   * Plan description
   */
  description?: string;
  /**
   * List of features included in the plan
   */
  features?: PlanFeature[];
  /**
   * Whether this plan is currently popular/recommended
   */
  isPopular?: boolean;
  /**
   * Whether this is the current user's plan
   */
  isCurrentPlan?: boolean;
  /**
   * Custom badge text (overrides default badges)
   */
  badge?: string;
  /**
   * Action button (e.g., "Subscribe", "Upgrade")
   */
  actionButton?: React.ReactNode;
  /**
   * Discount percentage for yearly plans
   */
  yearlyDiscount?: number;
}

/**
 * PlanCard - Displays subscription plan information
 * 
 * Used for showing subscription tiers, pricing comparisons,
 * and plan selection interfaces.
 * 
 * @example
 * ```tsx
 * <PlanCard
 *   name="Pro"
 *   price={19.99}
 *   billingPeriod="month"
 *   description="Perfect for serious creators"
 *   features={[
 *     { text: 'Unlimited posts', included: true },
 *     { text: 'Analytics dashboard', included: true },
 *     { text: 'Priority support', included: false },
 *   ]}
 *   isPopular
 *   actionButton={<button>Subscribe</button>}
 * />
 * ```
 */
export const PlanCard: React.FC<PlanCardProps> = ({
  name,
  price,
  billingPeriod = 'month',
  description,
  features = [],
  isPopular = false,
  isCurrentPlan = false,
  badge,
  actionButton,
  yearlyDiscount,
  className = '',
  variant = 'default',
  ...baseProps
}) => {
  const displayBadge = badge || (isCurrentPlan ? 'Current Plan' : isPopular ? 'Most Popular' : null);

  return (
    <BaseCard
      className={`relative flex flex-col h-full ${isPopular ? 'ring-2 ring-primary-500 dark:ring-primary-400' : ''} ${className}`}
      variant={variant}
      padding="lg"
      {...baseProps}
    >
      {/* Badge */}
      {displayBadge && (
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-semibold rounded-full ${
            isCurrentPlan
              ? 'bg-green-500 text-white'
              : isPopular
              ? 'bg-primary-500 text-white'
              : 'bg-gray-500 text-white'
          }`}
        >
          {displayBadge}
        </div>
      )}

      {/* Plan header */}
      <div className="text-center mb-6 pt-2">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {name}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">
            ${price.toFixed(2)}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            /{billingPeriod}
          </span>
        </div>
        {billingPeriod === 'year' && yearlyDiscount && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            Save {yearlyDiscount}% with annual billing
          </p>
        )}
      </div>

      {/* Features */}
      {features.length > 0 && (
        <ul className="space-y-3 mb-6 flex-1">
          {features.map((feature, index) => (
            <li
              key={index}
              className={`flex items-center gap-3 text-sm ${
                feature.included
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  feature.included
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}
              >
                {feature.included ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
              <span className={feature.included ? '' : 'line-through'}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Action button */}
      <div className="mt-auto">
        {actionButton}
      </div>
    </BaseCard>
  );
};

export default PlanCard;

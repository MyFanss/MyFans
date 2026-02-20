import React from 'react';
import { BaseCard, BaseCardProps } from './BaseCard';

export interface CreatorCardProps extends Omit<BaseCardProps, 'children'> {
  /**
   * Creator's display name
   */
  name: string;
  /**
   * Creator's username/handle
   */
  username: string;
  /**
   * Creator's avatar URL
   */
  avatarUrl?: string;
  /**
   * Creator's bio or description
   */
  bio?: string;
  /**
   * Number of subscribers/followers
   */
  subscriberCount?: number;
  /**
   * Monthly subscription price
   */
  subscriptionPrice?: number;
  /**
   * Whether the creator is verified
   */
  isVerified?: boolean;
  /**
   * Categories/tags for the creator
   */
  categories?: string[];
  /**
   * Custom action button
   */
  actionButton?: React.ReactNode;
  /**
   * Location string
   */
  location?: string;
}

/**
 * CreatorCard - Displays creator profile information
 * 
 * Used for showcasing content creators in browse/discovery views,
 * search results, and subscription management.
 * 
 * @example
 * ```tsx
 * <CreatorCard
 *   name="Jane Doe"
 *   username="janedoe"
 *   avatarUrl="/avatars/jane.jpg"
 *   bio="Digital artist and content creator"
 *   subscriberCount={15000}
 *   subscriptionPrice={9.99}
 *   isVerified
 *   categories={['Art', 'Digital']}
 * />
 * ```
 */
export const CreatorCard: React.FC<CreatorCardProps> = ({
  name,
  username,
  avatarUrl,
  bio,
  subscriberCount,
  subscriptionPrice,
  isVerified = false,
  categories = [],
  actionButton,
  location,
  className = '',
  ...baseProps
}) => {
  const formatSubscriberCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <BaseCard
      className={`flex flex-col gap-4 ${className}`}
      padding="lg"
      {...baseProps}
    >
      {/* Header with avatar and basic info */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 flex items-center justify-center text-white text-xl font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Name and username */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {name}
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">@{username}</p>
          {location && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {location}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {bio}
        </p>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 3).map((category, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Stats and action */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {subscriberCount !== undefined && (
            <div className="text-sm">
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatSubscriberCount(subscriberCount)}
              </span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">subscribers</span>
            </div>
          )}
          {subscriptionPrice !== undefined && (
            <div className="text-sm">
              <span className="font-semibold text-gray-900 dark:text-white">
                ${subscriptionPrice.toFixed(2)}
              </span>
              <span className="text-gray-500 dark:text-gray-400 ml-1">/month</span>
            </div>
          )}
        </div>
        {actionButton}
      </div>
    </BaseCard>
  );
};

export default CreatorCard;

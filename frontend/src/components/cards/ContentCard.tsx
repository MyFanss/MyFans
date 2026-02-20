import React from 'react';
import { BaseCard, BaseCardProps } from './BaseCard';
import Image from 'next/image';

export type ContentType = 'image' | 'video' | 'audio' | 'text' | 'live';
export type ContentStatus = 'published' | 'draft' | 'scheduled' | 'archived';

export interface ContentCardProps extends Omit<BaseCardProps, 'children'> {
  /**
   * Content title
   */
  title: string;
  /**
   * Content type
   */
  type: ContentType;
  /**
   * Thumbnail/cover image URL
   */
  thumbnailUrl?: string;
  /**
   * Content description or excerpt
   */
  description?: string;
  /**
   * Creator name
   */
  creatorName?: string;
  /**
   * Creator avatar URL
   */
  creatorAvatar?: string;
  /**
   * Publication date
   */
  publishedAt?: Date | string;
  /**
   * View count
   */
  viewCount?: number;
  /**
   * Like count
   */
  likeCount?: number;
  /**
   * Comment count
   */
  commentCount?: number;
  /**
   * Content status
   */
  status?: ContentStatus;
  /**
   * Whether content is locked (subscriber-only)
   */
  isLocked?: boolean;
  /**
   * Duration for video/audio content (in seconds)
   */
  duration?: number;
  /**
   * Whether content is live
   */
  isLive?: boolean;
  /**
   * Viewer count for live streams
   */
  liveViewerCount?: number;
  /**
   * Custom action menu
   */
  actionMenu?: React.ReactNode;
  /**
   * Click handler for the card
   */
  onContentClick?: () => void;
}

/**
 * ContentCard - Displays content items like posts, videos, images
 * 
 * Used for content feeds, galleries, and content management interfaces.
 * 
 * @example
 * ```tsx
 * <ContentCard
 *   title="My Latest Artwork"
 *   type="image"
 *   thumbnailUrl="/images/artwork.jpg"
 *   creatorName="Jane Doe"
 *   publishedAt={new Date()}
 *   viewCount={1234}
 *   likeCount={567}
 *   commentCount={89}
 * />
 * ```
 */
export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  type,
  thumbnailUrl,
  description,
  creatorName,
  creatorAvatar,
  publishedAt,
  viewCount,
  likeCount,
  commentCount,
  status = 'published',
  isLocked = false,
  duration,
  isLive = false,
  liveViewerCount,
  actionMenu,
  onContentClick,
  className = '',
  ...baseProps
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        );
      case 'audio':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17 3.5A1.5 1.5 0 0015.5 2h-11A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5v-13zM10 14a1 1 0 100-2 1 1 0 000 2zm3-6a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM6 7a1 1 0 011-1h1a1 1 0 010 2H7a1 1 0 01-1-1z" />
          </svg>
        );
      case 'live':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getStatusBadge = () => {
    const statusStyles: Record<ContentStatus, string> = {
      published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      archived: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <BaseCard
      className={`group ${className}`}
      padding="none"
      interactive={!!onContentClick}
      onClick={onContentClick}
      {...baseProps}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            {getTypeIcon()}
          </div>
        )}

        {/* Overlay for locked content */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-black/70 text-white rounded-md">
            {getTypeIcon()}
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-500 text-white rounded-md animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full"></span>
              LIVE
            </span>
          )}
        </div>

        {/* Duration badge */}
        {duration && !isLive && (
          <div className="absolute bottom-2 right-2 px-2 py-1 text-xs font-medium bg-black/70 text-white rounded-md">
            {formatDuration(duration)}
          </div>
        )}

        {/* Live viewer count */}
        {isLive && liveViewerCount && (
          <div className="absolute bottom-2 right-2 px-2 py-1 text-xs font-medium bg-black/70 text-white rounded-md flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            {formatNumber(liveViewerCount)} watching
          </div>
        )}

        {/* Action menu */}
        {actionMenu && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {actionMenu}
          </div>
        )}
      </div>

      {/* Content info */}
      <div className="p-4">
        {/* Status badge */}
        <div className="mb-2">
          {getStatusBadge()}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {description}
          </p>
        )}

        {/* Creator info */}
        {creatorName && (
          <div className="flex items-center gap-2 mb-3">
            {creatorAvatar ? (
              <Image
                src={creatorAvatar}
                alt={creatorName}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                {creatorName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {creatorName}
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            {viewCount !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                {formatNumber(viewCount)}
              </span>
            )}
            {likeCount !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                </svg>
                {formatNumber(likeCount)}
              </span>
            )}
            {commentCount !== undefined && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                {formatNumber(commentCount)}
              </span>
            )}
          </div>
          {publishedAt && (
            <span className="text-xs">{formatDate(publishedAt)}</span>
          )}
        </div>
      </div>
    </BaseCard>
  );
};

export default ContentCard;

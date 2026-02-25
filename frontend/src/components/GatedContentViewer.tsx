'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export type ContentType = 'image' | 'video' | 'audio' | 'text' | 'live';

export interface GatedContentViewerProps {
  /** Unique content identifier */
  contentId: string;
  /** Content title */
  title: string;
  /** Content type */
  type: ContentType;
  /** Full content URL (image src, video src, etc.) */
  contentUrl?: string;
  /** Thumbnail for locked state */
  thumbnailUrl?: string;
  /** Content description or body */
  description?: string;
  /** Whether the current user has subscribed */
  isSubscribed: boolean;
  /** Whether the content requires subscription to access */
  isGated: boolean;
  /** Creator information */
  creator: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string;
    isVerified?: boolean;
  };
  /** Content metadata */
  metadata?: {
    publishedAt?: Date | string;
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    duration?: string;
    tags?: string[];
  };
  /** Related content items */
  relatedContent?: Array<{
    id: string;
    title: string;
    thumbnailUrl?: string;
    type: ContentType;
  }>;
  /** Callback when user clicks subscribe */
  onSubscribe?: () => void;
  /** Callback when user likes content */
  onLike?: () => void;
  /** Callback when user shares content */
  onShare?: () => void;
}

/**
 * GatedContentViewer - Displays content with lock overlay for non-subscribers
 * 
 * Features:
 * - Lock overlay for non-subscribers on gated content
 * - Full content view for subscribers
 * - Content metadata display
 * - Creator card
 * - Related content section
 */
export function GatedContentViewer({
  contentId,
  title,
  type,
  contentUrl,
  thumbnailUrl,
  description,
  isSubscribed,
  isGated,
  creator,
  metadata,
  relatedContent = [],
  onSubscribe,
  onLike,
  onShare,
}: GatedContentViewerProps) {
  const [isLiked, setIsLiked] = useState(false);
  
  // Determine if content should be locked
  const showLockedState = isGated && !isSubscribed;
  
  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.();
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatCount = (count?: number) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const renderContentPlayer = () => {
    if (showLockedState) {
      return (
        <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {/* Thumbnail */}
          {thumbnailUrl && (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              className="object-cover"
            />
          )}
          
          {/* Lock Overlay */}
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <div className="text-center p-8">
              {/* Lock Icon */}
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                <svg 
                  className="w-10 h-10 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                  />
                </svg>
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">
                Subscribe to Unlock
              </h3>
              <p className="text-gray-300 mb-6 max-w-md">
                This content is available exclusively for {creator.name}&apos;s subscribers.
                Subscribe now to get full access.
              </p>
              
              <button
                onClick={onSubscribe}
                type="button"
                className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Subscribe to {creator.name}
              </button>
              
              <p className="text-gray-400 text-sm mt-4">
                Already a subscriber? Sign in to access
              </p>
            </div>
          </div>
          
          {/* Blur effect on thumbnail */}
          {thumbnailUrl && (
            <div className="absolute inset-0 backdrop-blur-sm" />
          )}
        </div>
      );
    }

    // Full content view for subscribers
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
        {type === 'video' && contentUrl && (
          <video
            src={contentUrl}
            controls
            className="w-full h-full object-contain"
            poster={thumbnailUrl}
          />
        )}
        {type === 'audio' && contentUrl && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-32 h-32 mb-4 relative">
              <Image
                src={thumbnailUrl || '/placeholder-music.jpg'}
                alt={title}
                fill
                className="rounded-full object-cover"
              />
            </div>
            <audio
              src={contentUrl}
              controls
              className="w-full max-w-md mt-4"
            />
          </div>
        )}
        {type === 'image' && contentUrl && (
          <Image
            src={contentUrl}
            alt={title}
            fill
            className="object-contain"
          />
        )}
        {type === 'text' && (
          <div className="p-8 h-full overflow-auto">
            <p className="text-lg leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Content Player */}
      {renderContentPlayer()}

      {/* Content Info */}
      <div className="mt-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h1>
        
        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
          {metadata?.publishedAt && (
            <span>{formatDate(metadata.publishedAt)}</span>
          )}
          {metadata?.viewCount !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {formatCount(metadata.viewCount)} views
            </span>
          )}
          {metadata?.duration && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {metadata.duration}
            </span>
          )}
          {metadata?.tags && metadata.tags.length > 0 && (
            <div className="flex gap-2">
              {metadata.tags.map((tag) => (
                <span 
                  key={tag}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleLike}
            type="button"
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isLiked 
                ? 'bg-red-100 text-red-600 focus-visible:outline-red-600 dark:bg-red-900/30' 
                : 'bg-gray-100 text-gray-600 focus-visible:outline-primary-500 dark:bg-gray-800 hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {formatCount((metadata?.likeCount || 0) + (isLiked ? 1 : 0))}
          </button>
          
          <button
            onClick={onShare}
            type="button"
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:bg-gray-800 dark:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>

        {/* Creator Card */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-6">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12">
              <Image
                src={creator.avatarUrl || '/default-avatar.jpg'}
                alt={creator.name}
                fill
                className="rounded-full object-cover"
              />
              {creator.isVerified && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {creator.name}
              </h3>
              <p className="text-sm text-gray-500">@{creator.username}</p>
            </div>
          </div>
          
          {!isSubscribed && (
            <button
              onClick={onSubscribe}
              type="button"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              Subscribe
            </button>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              About this content
            </h3>
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {description}
            </p>
          </div>
        )}

        {/* Related Content */}
        {relatedContent.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Related Content
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {relatedContent.map((item) => (
                <a
                  key={item.id}
                  href={`/content/${item.id}`}
                  className="group block"
                >
                  <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-2">
                    {item.thumbnailUrl && (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    {/* Type badge */}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      {item.type}
                    </div>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-primary-600">
                    {item.title}
                  </h4>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GatedContentViewer;

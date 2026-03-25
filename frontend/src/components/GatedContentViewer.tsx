'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/states';
import { useToast } from '@/contexts/ToastContext';
import type { AppError } from '@/types/errors';

export type ContentType = 'image' | 'video' | 'audio' | 'text' | 'live';
export type AccessStatus = 'loading' | 'locked' | 'unlocked' | 'error';

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
  /** External loading state */
  isLoading?: boolean;
  /** External error */
  error?: AppError | string | null;
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
  /** Callback to check access manually */
  onCheckAccess?: () => Promise<boolean>;
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
 * - Loading and error states
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
  isLoading: externalLoading = false,
  error: externalError = null,
  creator,
  metadata,
  relatedContent = [],
  onCheckAccess,
  onSubscribe,
  onLike,
  onShare,
}: GatedContentViewerProps) {
  const { showError } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [contentImageLoaded, setContentImageLoaded] = useState<Record<string, boolean>>({});
  const [relatedLoaded, setRelatedLoaded] = useState<Record<string, boolean>>({});
  
  // Internal access state
  const [internalStatus, setInternalStatus] = useState<AccessStatus>('loading');
  const [internalError, setInternalError] = useState<string | null>(null);

  // Sync with props and handle access check
  useEffect(() => {
    const checkAccess = async () => {
      // If not gated, it's always unlocked
      if (!isGated) {
        setInternalStatus('unlocked');
        return;
      }

      // If we have an external error, show error state
      if (externalError) {
        setInternalStatus('error');
        setInternalError(typeof externalError === 'string' ? externalError : externalError.message);
        return;
      }

      // If external loading is true, we are still loading
      if (externalLoading) {
        setInternalStatus('loading');
        return;
      }

      // Perform access check
      try {
        setInternalStatus('loading');
        
        let hasAccess = isSubscribed;
        
        // If provided, call external check access
        if (onCheckAccess) {
          hasAccess = await onCheckAccess();
        }

        setInternalStatus(hasAccess ? 'unlocked' : 'locked');
      } catch (err) {
        setInternalStatus('error');
        setInternalError(err instanceof Error ? err.message : 'Failed to verify access');
        showError('ACCESS_DENIED', {
          message: 'Access check failed',
          description: 'Could not verify your subscription status.',
        });
      }
    };

    checkAccess();
  }, [contentId, isGated, isSubscribed, externalLoading, externalError, onCheckAccess, showError]);
  
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
    // Loading State
    if (internalStatus === 'loading') {
      return (
        <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex flex-col items-center justify-center space-y-4">
          <Skeleton className="w-full h-full" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Verifying access...</p>
          </div>
        </div>
      );
    }

    // Error State
    if (internalStatus === 'error') {
      return (
        <div className="w-full aspect-video bg-red-50 dark:bg-red-900/10 rounded-lg overflow-hidden flex flex-col items-center justify-center p-8 text-center border-2 border-red-100 dark:border-red-900/20">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">Failed to load content</h3>
          <p className="text-red-700 dark:text-red-400 max-w-sm mb-6">{internalError || 'An unexpected error occurred while verifying access.'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    // Locked State
    if (internalStatus === 'locked') {
      return (
        <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden group">
          {/* Thumbnail with heavy blur */}
          {thumbnailUrl && (
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
              <Image
                src={thumbnailUrl}
                alt={title}
                fill
                className="object-cover blur-xl opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
            </div>
          )}
          
          {/* Lock Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="text-center p-8">
              {/* Lock Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-110">
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
              
              <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                Exclusive Content
              </h3>
              <p className="text-gray-300 mb-8 max-w-md mx-auto leading-relaxed">
                Join {creator.name}&apos;s inner circle to unlock this {type} and hundreds of other exclusive drops.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={onSubscribe}
                  type="button"
                  className="w-full sm:w-auto px-8 py-3.5 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-primary-500/25 active:scale-95"
                >
                  Subscribe to {creator.name}
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl backdrop-blur-md border border-white/10 transition-all active:scale-95"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Unlocked / Un-gated State
    return (
      <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-200 dark:ring-gray-800">
        {type === 'video' && contentUrl && (
          <video
            src={contentUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
            poster={thumbnailUrl}
          />
        )}
        {type === 'audio' && contentUrl && (
          <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-b from-gray-900 to-black">
            <div className="w-48 h-48 mb-8 relative shadow-2xl">
              <Image
                src={thumbnailUrl || '/placeholder-music.jpg'}
                alt={title}
                fill
                className="rounded-2xl object-cover ring-4 ring-white/10"
              />
              <div className="absolute inset-0 bg-black/20 rounded-2xl" />
            </div>
            <audio
              src={contentUrl}
              controls
              autoPlay
              className="w-full max-w-md mt-4 accent-primary-500"
            />
          </div>
        )}
        {type === 'image' && contentUrl && (
          <div className="image-skeleton-wrapper relative h-full w-full">
            <Image
              src={contentUrl}
              alt={title}
              width={1920}
              height={1080}
              priority
              onLoad={() =>
                setContentImageLoaded((prev) => ({ ...prev, [contentUrl]: true }))
              }
              className={`lazy-image h-full w-full object-contain transition-opacity duration-500 ${
                contentImageLoaded[contentUrl] ? 'opacity-100' : 'opacity-0'
              }`}
              sizes="100vw"
            />
            {!contentImageLoaded[contentUrl] && <Skeleton className="absolute inset-0" />}
          </div>
        )}
        {type === 'text' && (
          <div className="p-10 h-full overflow-auto bg-white dark:bg-gray-900">
            <div className="max-w-2xl mx-auto">
              <p className="text-xl leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-serif">
                {description}
              </p>
            </div>
          </div>
        )}
        {type === 'live' && (
           <div className="relative h-full w-full flex items-center justify-center bg-gray-900">
             <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
               <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1.5">
                 <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                 LIVE
               </span>
               <span className="px-2 py-1 bg-black/50 text-white text-xs font-medium rounded backdrop-blur-md">
                 {formatCount(metadata?.viewCount || 0)} watching
               </span>
             </div>
             <p className="text-white font-medium">Live stream would play here</p>
           </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20 animate-fade-in">
      {/* Content Player */}
      <div className="mb-8">
        {renderContentPlayer()}
      </div>

      {/* Content Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
            {title}
          </h1>
          
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-gray-500 dark:text-gray-400 mb-6">
            {metadata?.publishedAt && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(metadata.publishedAt)}
              </span>
            )}
            {metadata?.viewCount !== undefined && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {formatCount(metadata.viewCount)} views
              </span>
            )}
            {metadata?.duration && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {metadata.duration}
              </span>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-3 py-6 border-y border-gray-100 dark:border-gray-800 mb-8">
            <button
              onClick={handleLike}
              type="button"
              className={`group flex items-center gap-2 rounded-xl px-5 py-2.5 transition-all active:scale-95 ${
                isLiked 
                  ? 'bg-red-50 text-red-600 dark:bg-red-900/20' 
                  : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <svg 
                className={`w-6 h-6 transition-transform group-hover:scale-110 ${isLiked ? 'fill-current' : 'fill-none'}`} 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="font-bold">{formatCount((metadata?.likeCount || 0) + (isLiked ? 1 : 0))}</span>
            </button>
            
            <button
              onClick={onShare}
              type="button"
              className="flex items-center gap-2 rounded-xl bg-gray-50 px-5 py-2.5 text-gray-700 font-bold transition-all hover:bg-gray-100 active:scale-95 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>

            {metadata?.tags && metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 ml-auto">
                {metadata.tags.map((tag) => (
                  <span 
                    key={tag}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* About Section */}
          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Description
            </h3>
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {description || 'No description provided for this content.'}
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Creator Profile */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center text-center">
              <div className="relative w-24 h-24 mb-4">
                <Image
                  src={creator.avatarUrl || '/default-avatar.jpg'}
                  alt={creator.name}
                  fill
                  className="rounded-full object-cover ring-4 ring-gray-50 dark:ring-gray-900"
                />
                {creator.isVerified && (
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {creator.name}
              </h3>
              <p className="text-sm text-gray-500 mb-6">@{creator.username}</p>
              
              {!isSubscribed && (
                <button
                  onClick={onSubscribe}
                  type="button"
                  className="w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  Subscribe to unlock
                </button>
              )}
              
              <Link 
                href={`/creator/${creator.username}`}
                className="mt-4 text-sm font-bold text-gray-500 hover:text-primary-500 transition-colors"
              >
                View full profile
              </Link>
            </div>
          </div>

          {/* Related Items Sidebar */}
          {relatedContent.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Up next
              </h3>
              <div className="space-y-4">
                {relatedContent.map((item) => (
                  <Link
                    key={item.id}
                    href={`/content/${item.id}`}
                    className="flex gap-3 group"
                  >
                    <div className="relative w-28 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                      {item.thumbnailUrl && (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-110"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight group-hover:text-primary-500 transition-colors">
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1 block">
                        {item.type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GatedContentViewer;

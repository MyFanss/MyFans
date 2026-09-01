'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GatedContentViewer } from '@/components/GatedContentViewer';
import { SubscriptionStatusBadge } from '@/components/subscription/SubscriptionStatusBadge';
import { ContentComments } from './content-comments';
import {
  getSubscriptionStatusCopy,
  type SubscriptionStatus,
} from '@/lib/subscription-status';
import {
  getSubscriptionStatusForCreator,
  getWalletSession,
} from '@/lib/client-session';
import {
  getContentAccess,
  type ContentAccessReason,
  type ContentMetadata,
} from '@/lib/api/content';
import {
  getPostLikeCount,
  getPostLikeStatus,
  togglePostLike,
} from '@/lib/api/likes';

interface ClientContentProps {
  content: ContentMetadata;
}

type AccessState =
  | { status: 'loading' }
  | { status: 'granted' }
  | { status: 'denied'; reason: ContentAccessReason };

/**
 * Whether this content is gated at all. `locked` is the server's explicit
 * signal; `isGated` is the fallback for responses that don't send it.
 */
function isContentGated(content: ContentMetadata): boolean {
  return content.locked === true || content.isGated;
}

export function ClientContent({ content }: ClientContentProps) {
  const router = useRouter();

  // Subscription *badge* is a per-viewer display hint only — it never
  // decides what media is shown. The gate below is server-authoritative.
  const [subscriptionStatus] = useState<SubscriptionStatus>(() => {
    const persistedById = getSubscriptionStatusForCreator(content.creator.id);
    const persistedByUsername = getSubscriptionStatusForCreator(
      content.creator.username,
    );
    return persistedById ?? persistedByUsername ?? 'expired';
  });
  const subscriptionCopy = getSubscriptionStatusCopy(subscriptionStatus);
  const [hasWalletSession] = useState(
    () => typeof window !== 'undefined' && !!getWalletSession(),
  );

  const gated = isContentGated(content);

  // Resolve access from the API (fail closed). If the detail payload already
  // told us, trust it and skip the extra round trip.
  const [access, setAccess] = useState<AccessState>(() => {
    if (!gated) return { status: 'granted' };
    if (typeof content.hasAccess === 'boolean') {
      return content.hasAccess
        ? { status: 'granted' }
        : { status: 'denied', reason: 'subscription_required' };
    }
    return { status: 'loading' };
  });

  useEffect(() => {
    if (!gated || access.status !== 'loading') return;

    let cancelled = false;
    getContentAccess(content.id)
      .then((result) => {
        if (cancelled) return;
        setAccess(
          result.hasAccess
            ? { status: 'granted' }
            : { status: 'denied', reason: result.reason },
        );
      })
      .catch(() => {
        if (!cancelled) setAccess({ status: 'denied', reason: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [gated, access.status, content.id]);

  const isUnlocked = !gated || access.status === 'granted';
  const [likeState, setLikeState] = useState({ liked: false, count: content.metadata?.likeCount ?? 0 });

  useEffect(() => {
    if (!isUnlocked) {
      setLikeState({ liked: false, count: content.metadata?.likeCount ?? 0 });
      return;
    }

    let cancelled = false;

    Promise.all([
      getPostLikeStatus(content.id),
      getPostLikeCount(content.id),
    ])
      .then(([liked, count]) => {
        if (cancelled) return;
        setLikeState({ liked, count });
      })
      .catch(() => {
        if (!cancelled) {
          setLikeState({
            liked: false,
            count: content.metadata?.likeCount ?? 0,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content.id, content.metadata?.likeCount, isUnlocked]);

  const handleSubscribe = useCallback(() => {
    // Route to the real subscribe/checkout flow — no client-side unlock.
    router.push(`/subscribe/${encodeURIComponent(content.creator.id)}`);
  }, [router, content.creator.id]);

  const handleLike = useCallback(
    async (liked: boolean): Promise<void> => {
      if (!isUnlocked) return;

      const previous = likeState;
      const nextLiked = liked;
      const delta = nextLiked && !previous.liked ? 1 : !nextLiked && previous.liked ? -1 : 0;

      setLikeState((current) => ({
        liked: nextLiked,
        count: Math.max(0, current.count + delta),
      }));

      try {
        const result = await togglePostLike(content.id, nextLiked);
        const nextCount = typeof result.count === 'number' ? result.count : await getPostLikeCount(content.id);
        setLikeState({
          liked: Boolean(result.liked),
          count: nextCount,
        });
      } catch (error) {
        setLikeState(previous);
        const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: number }).status) : undefined;

        if (status === 401 || status === 403) {
          router.push(`/auth/sign-in?redirectTo=${encodeURIComponent(`/content/${content.id}`)}`);
          return;
        }

        throw error;
      }
    },
    [content.id, isUnlocked, likeState, router],
  );

  const handleShare = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share({ title: content.title, url: window.location.href });
    }
  }, [content.title]);

  const handleCheckAccess = useCallback(async (): Promise<boolean> => {
    if (!gated) return true;
    const result = await getContentAccess(content.id);
    setAccess(
      result.hasAccess
        ? { status: 'granted' }
        : { status: 'denied', reason: result.reason },
    );
    return result.hasAccess;
  }, [gated, content.id]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3 mb-8">
        <SubscriptionStatusBadge status={subscriptionStatus} />
        {!isUnlocked && (
          <button
            onClick={handleSubscribe}
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {hasWalletSession
              ? subscriptionCopy.ctaLabel
              : 'Connect wallet to subscribe'}
          </button>
        )}
      </div>

      <GatedContentViewer
        contentId={content.id}
        title={content.title}
        type={content.type as 'video' | 'image' | 'audio' | 'text'}
        contentUrl={content.contentUrl}
        thumbnailUrl={content.thumbnailUrl}
        description={content.description}
        isSubscribed={isUnlocked}
        subscriptionStatus={subscriptionStatus}
        isGated={gated}
        canInteract={isUnlocked}
        creator={content.creator}
        metadata={{ ...content.metadata, likeCount: likeState.count } as never}
        liked={likeState.liked}
        relatedContent={content.relatedContent}
        onCheckAccess={handleCheckAccess}
        onSubscribe={handleSubscribe}
        onLike={handleLike}
        onShare={handleShare}
      />

      {/*
        Comments policy (#1610): comments are part of the gated surface. They
        render ONLY once access has been granted — a locked viewer sees no
        comment thread and no comment form. This keeps subscriber-only
        discussion out of the teaser view and matches how Like is gated via
        `canInteract`. See docs/CONTENT_ACCESS.md.
      */}
      {isUnlocked && (
        <ContentComments
          contentId={content.id}
          commentCount={content.metadata?.commentCount ?? 0}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { GatedContentViewer } from '@/components/GatedContentViewer';
import { SubscriptionStatusBadge } from '@/components/subscription/SubscriptionStatusBadge';
import {
  getSubscriptionStatusCopy,
  isSubscriptionActive,
  type SubscriptionStatus,
} from '@/lib/subscription-status';
import {
  getSubscriptionStatusForCreator,
  getWalletSession,
  setSubscriptionStatusForCreator,
} from '@/lib/client-session';
import type { ContentMetadata } from '@/lib/api/content';

interface ClientContentProps {
  content: ContentMetadata;
}

export function ClientContent({ content }: ClientContentProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(() => {
    const persistedById = getSubscriptionStatusForCreator(content.creator.id);
    const persistedByUsername = getSubscriptionStatusForCreator(
      content.creator.username,
    );
    return (
      persistedById ??
      persistedByUsername ??
      'expired'
    );
  });
  const [hasWalletSession] = useState(() => typeof window !== 'undefined' && !!getWalletSession());
  const isSubscribed = isSubscriptionActive(subscriptionStatus);
  const subscriptionCopy = getSubscriptionStatusCopy(subscriptionStatus);

  const handleSubscribe = () => {
    if (!getWalletSession()) {
      return;
    }
    setSubscriptionStatusForCreator(content.creator.id, 'active');
    setSubscriptionStatusForCreator(content.creator.username, 'active');
    setSubscriptionStatus('active');
  };

  const handleLike = async (liked: boolean): Promise<void> => {
    void liked;
    console.log('Liked content:', content.id);
  };

  const handleShare = () => {
    console.log('Share content:', content.id);
  };

  const handleCheckAccess = async (): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return isSubscribed;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3 mb-8">
        <SubscriptionStatusBadge status={subscriptionStatus} />
        {!isSubscribed && (
          <button
            onClick={handleSubscribe}
            type="button"
            disabled={!hasWalletSession}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            {hasWalletSession ? subscriptionCopy.ctaLabel : 'Connect wallet to subscribe'}
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
        isSubscribed={isSubscribed}
        subscriptionStatus={subscriptionStatus}
        isGated={content.isGated}
        creator={content.creator}
        metadata={content.metadata as any}
        relatedContent={content.relatedContent}
        onCheckAccess={handleCheckAccess}
        onSubscribe={handleSubscribe}
        onLike={handleLike}
        onShare={handleShare}
      />
    </div>
  );
}

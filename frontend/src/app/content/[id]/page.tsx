'use client';

import React, { useEffect, useState } from 'react';
import { GatedContentViewer, ContentType } from '@/components/GatedContentViewer';
import { SubscriptionStatusBadge } from '@/components/subscription/SubscriptionStatusBadge';
import {
  getMockViewerSubscriptionStatus,
  getSubscriptionStatusCopy,
  isSubscriptionActive,
  type SubscriptionStatus,
} from '@/lib/subscription-status';
import {
  getSubscriptionStatusForCreator,
  getWalletSession,
  setSubscriptionStatusForCreator,
} from '@/lib/client-session';
import Link from 'next/link';

// Mock data - in real app, fetch from API based on params.id
const mockContentData = {
  id: '1',
  title: 'Exclusive Behind the Scenes - Studio Session',
  type: 'video' as ContentType,
  contentUrl: '/sample-video.mp4',
  thumbnailUrl: '/placeholder-1.jpg',
  description: 'Join me in this exclusive behind-the-scenes look at my latest studio session. I\'ll be sharing my creative process, the equipment I use, and some exclusive tips for aspiring creators.\n\nThis is premium content available only to my subscribers. Thank you for your support!',
  isGated: true,
  creator: {
    id: 'c1',
    name: 'Lena Nova',
    username: 'lena.nova',
    avatarUrl: '/placeholder-2.jpg',
    isVerified: true,
  },
  metadata: {
    publishedAt: new Date('2024-01-15'),
    viewCount: 15420,
    likeCount: 892,
    commentCount: 124,
    duration: '12:34',
    tags: ['behindthecenes', 'studio', 'exclusive', 'creative'],
  },
  relatedContent: [
    {
      id: '2',
      title: 'Q&A Session - Answering Your Questions',
      thumbnailUrl: '/placeholder-3.jpg',
      type: 'video' as ContentType,
    },
    {
      id: '3',
      title: 'My Top 5 Photography Tips',
      thumbnailUrl: '/placeholder-1.jpg',
      type: 'video' as ContentType,
    },
    {
      id: '4',
      title: 'Equipment Tour 2024',
      thumbnailUrl: '/placeholder-2.jpg',
      type: 'video' as ContentType,
    },
  ],
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ContentPage({ params }: PageProps) {
  void params;

  // In a real app, you would fetch the content based on the ID
  const [content] = useState(mockContentData);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(() => {
    const persistedById = getSubscriptionStatusForCreator(mockContentData.creator.id);
    const persistedByUsername = getSubscriptionStatusForCreator(
      mockContentData.creator.username,
    );
    return (
      persistedById ??
      persistedByUsername ??
      getMockViewerSubscriptionStatus(mockContentData.creator.username) ??
      'expired'
    );
  });
  const [hasWalletSession, setHasWalletSession] = useState(false);
  const isSubscribed = isSubscriptionActive(subscriptionStatus);
  const subscriptionCopy = getSubscriptionStatusCopy(subscriptionStatus);

  useEffect(() => {
    setHasWalletSession(!!getWalletSession());
  }, []);

  const handleSubscribe = () => {
    if (!getWalletSession()) {
      return;
    }
    setSubscriptionStatusForCreator(mockContentData.creator.id, 'active');
    setSubscriptionStatusForCreator(mockContentData.creator.username, 'active');
    setSubscriptionStatus('active');
  };

  const handleLike = async (liked: boolean): Promise<void> => {
    void liked;
    console.log('Liked content:', content.id);
  };

  const handleShare = () => {
    console.log('Share content:', content.id);
    // In real app, open share dialog
  };

  const handleCheckAccess = async (): Promise<boolean> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // For demo purposes, we'll return the current isSubscribed state
    return isSubscribed;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation placeholder */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-3">
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
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        <GatedContentViewer
          contentId={content.id}
          title={content.title}
          type={content.type}
          contentUrl={content.contentUrl}
          thumbnailUrl={content.thumbnailUrl}
          description={content.description}
          isSubscribed={isSubscribed}
          subscriptionStatus={subscriptionStatus}
          isGated={content.isGated}
          creator={content.creator}
          metadata={content.metadata}
          relatedContent={content.relatedContent}
          onCheckAccess={handleCheckAccess}
          onSubscribe={handleSubscribe}
          onLike={handleLike}
          onShare={handleShare}
        />
      </main>
    </div>
  );
}

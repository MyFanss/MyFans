'use client';

import React, { useState } from 'react';
import { GatedContentViewer, ContentType } from '@/components/GatedContentViewer';

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
    id: 'creator-1',
    name: 'Alex Rivera',
    username: 'alexrivera',
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
  // In a real app, you would fetch the content based on the ID
  const [content] = useState(mockContentData);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = () => {
    // In real app, redirect to subscription page or open modal
    setIsSubscribed(true);
  };

  const handleLike = () => {
    console.log('Liked content:', content.id);
  };

  const handleShare = () => {
    console.log('Share content:', content.id);
    // In real app, open share dialog
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation placeholder */}
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <a href="/" className="text-xl font-bold text-primary-600">
              MyFans
            </a>
            <div className="flex items-center gap-4">
              {isSubscribed ? (
                <span className="text-sm text-green-600 font-medium">
                  ✓ Subscribed
                </span>
              ) : (
                <button
                  onClick={handleSubscribe}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Subscribe
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
          isGated={content.isGated}
          creator={content.creator}
          metadata={content.metadata}
          relatedContent={content.relatedContent}
          onSubscribe={handleSubscribe}
          onLike={handleLike}
          onShare={handleShare}
        />
      </main>
    </div>
  );
}

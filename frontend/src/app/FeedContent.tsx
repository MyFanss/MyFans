"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getFeed, type FeedPage } from "@/lib/api/feed";
import { publicPostToCreatorPost } from "@/lib/api/posts";
import type { CreatorPost } from "@/lib/creator-profile";
import { ContentCard } from "@/components/cards";
import { usePrefetchCreatorRoute } from "@/hooks/usePrefetchCreatorRoute";
import ContentCardSkeleton from "@/components/ui/ContentCardSkeleton";

const INITIAL_LOAD = 12;
const LOAD_MORE_COUNT = 8;

export function FeedContent() {
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getFeed({ limit: INITIAL_LOAD });
        if (!cancelled) {
          setPosts(result.data.map(publicPostToCreatorPost));
          setNextCursor(result.nextCursor);
          setHasMore(result.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load feed";
          setError(message);
          setPosts([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load more
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !nextCursor) return;

    setIsLoading(true);

    try {
      const result = await getFeed({
        cursor: nextCursor,
        limit: LOAD_MORE_COUNT,
      });
      setPosts((prev) => [...prev, ...result.data.map(publicPostToCreatorPost)]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load more posts";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, nextCursor]);

  // Infinite scroll
  useEffect(() => {
    const currentLoadMoreRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          void loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (currentLoadMoreRef) {
      observer.observe(currentLoadMoreRef);
    }

    return () => {
      if (currentLoadMoreRef) {
        observer.unobserve(currentLoadMoreRef);
      }
    };
  }, [loadMore, hasMore, isLoading]);

  if (error && posts.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Failed to load feed
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No posts yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
              You haven't subscribed to any creators yet. Find creators to follow and get exclusive content.
            </p>
            <a
              href="/discover"
              className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              Discover creators
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Your Feed
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Latest posts from creators you follow
        </p>

        {/* Posts Grid */}
        <div className="space-y-6">
          {posts.map((post) => (
            <ContentCard
              key={post.id}
              title={post.title}
              type={post.type}
              description={post.excerpt}
              publishedAt={post.publishedAt}
              likeCount={post.likeCount}
              isLocked={post.isLocked}
            />
          ))}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-6 mt-6">
            {[...Array(4)].map((_, i) => (
              <ContentCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="py-8">
            {isLoading && (
              <div className="space-y-6">
                {[...Array(2)].map((_, i) => (
                  <ContentCardSkeleton key={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

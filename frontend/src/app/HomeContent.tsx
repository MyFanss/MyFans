"use client";

import { Hero } from "@/components/landing";
import { FeedContent } from "./FeedContent";
import { useAuth } from "@/hooks/useAuth";

export function HomeContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
            <div className="mt-8 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-200 dark:bg-gray-700 rounded"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <FeedContent />;
  }

  return <Hero />;
}

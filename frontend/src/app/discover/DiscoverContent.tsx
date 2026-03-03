"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CreatorCard } from "@/components/cards";
import {
  CATEGORIES,
  SORT_OPTIONS,
  getCreators,
  CreatorProfile,
  SortOption,
} from "@/lib/creator-profile";

const DEBOUNCE_DELAY = 300;
const INITIAL_LOAD = 12;
const LOAD_MORE_COUNT = 8;

function DiscoverContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-synced state
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get("categories")?.split(",").filter(Boolean) || [],
  );
  const [sort, setSort] = useState<SortOption>(
    (searchParams.get("sort") as SortOption) || "popular",
  );

  // UI state
  const [displayedCreators, setDisplayedCreators] = useState<CreatorProfile[]>(
    [],
  );
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Infinite scroll ref
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [search]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (selectedCategories.length > 0)
      params.set("categories", selectedCategories.join(","));
    if (sort !== "popular") params.set("sort", sort);

    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch, selectedCategories, sort, router]);

  // Fetch creators
  useEffect(() => {
    // Use requestAnimationFrame to avoid cascading renders ESLint warning
    requestAnimationFrame(() => {
      const result = getCreators({
        search: debouncedSearch,
        categories: selectedCategories,
        sort,
        page: 1,
        limit: INITIAL_LOAD,
      });
      setDisplayedCreators(result.creators);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setPage(1);
    });
  }, [debouncedSearch, selectedCategories, sort]);

  // Infinite scroll - load more
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    const nextPage = page + 1;
    const result = getCreators({
      search: debouncedSearch,
      categories: selectedCategories,
      sort,
      page: nextPage,
      limit: LOAD_MORE_COUNT,
    });

    setDisplayedCreators((prev) => [...prev, ...result.creators]);
    setHasMore(result.hasMore);
    setPage(nextPage);
    setIsLoading(false);
  }, [isLoading, hasMore, page, debouncedSearch, selectedCategories, sort]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [loadMore, hasMore, isLoading]);

  // Toggle category filter
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setSort("popular");
  };

  const hasActiveFilters =
    debouncedSearch || selectedCategories.length > 0 || sort !== "popular";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Discover Creators
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find and support your favorite content creators
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Input */}
        <div className="max-w-md">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search creators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategories.includes(category)
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Sort and Clear */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-48">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              Clear all filters
            </button>
          )}

          <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
            {total} creator{total !== 1 ? "s" : ""} found
          </span>
        </div>
      </div>

      {/* Active Filters Display */}
      {selectedCategories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              {category} ×
            </button>
          ))}
        </div>
      )}

      {/* Creator Cards Grid */}
      {displayedCreators.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedCreators.map((creator) => (
            <CreatorCard
              key={creator.id}
              name={creator.displayName}
              username={creator.username}
              avatarUrl={creator.avatarUrl}
              bio={creator.bio}
              subscriberCount={creator.subscriberCount}
              subscriptionPrice={creator.subscriptionPrice}
              isVerified={creator.isVerified}
              categories={creator.categories}
              location={creator.location}
              actionButton={
                <a
                  href={`/creator/${creator.username}`}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Subscribe
                </a>
              }
            />
          ))}
        </div>
      ) : !isLoading ? (
        /* Empty State */
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No creators found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
            {hasActiveFilters
              ? "Try adjusting your search or filters to find more creators"
              : "There are no creators available at the moment"}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : null}

      {/* Infinite Scroll Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading more creators...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function DiscoverContent() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <div className="mb-8">
            <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
            <div className="h-5 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="mb-6 space-y-4">
            <div className="h-10 w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
                ></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      }
    >
      <DiscoverContentInner />
    </Suspense>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

/**
 * Hook that prefetches a creator route when the user hovers over an element.
 *
 * Uses Next.js router.prefetch() to eagerly load the JS/data for the
 * creator profile page, reducing perceived latency when the user clicks.
 *
 * @example
 * ```tsx
 * const { prefetchOnHover, hoverHandlers } = usePrefetchCreatorRoute(username);
 * // ...
 * <a {...hoverHandlers} href={`/creator/${username}`}>View Profile</a>
 * ```
 */
export function usePrefetchCreatorRoute(username: string) {
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(`/creator/${username}`);
  }, [router, username]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      prefetch();
      // Allow the original onMouseEnter to still fire if provided
      const target = e.currentTarget as HTMLElement;
      target.dataset.prefetched = 'true';
    },
    [prefetch],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      prefetch();
      const target = e.currentTarget as HTMLElement;
      target.dataset.prefetched = 'true';
    },
    [prefetch],
  );

  return {
    /** Prefetch the route immediately (useful for programmatic calls) */
    prefetch,
    /** Spread onto an anchor/link element to enable hover + touch prefetch */
    hoverHandlers: {
      onMouseEnter: handleMouseEnter,
      onTouchStart: handleTouchStart,
    },
  };
}

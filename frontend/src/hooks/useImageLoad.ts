import { useCallback, useState } from 'react';

/**
 * useImageLoad - tracks whether a given image URL has finished loading.
 *
 * Returns a stable `onLoad` callback and the current `isLoaded` boolean.
 * Use the callback as the `onLoad` prop on a `<img>` or `next/image`
 * component; set the image's initial opacity to 0 (via the `.lazy-image`
 * CSS class defined in globals.css) and flip it to 1 once `isLoaded` is
 * true to produce a smooth fade-in effect.
 *
 * @example
 * ```tsx
 * const { isLoaded, onLoad } = useImageLoad();
 *
 * <div className="image-skeleton-wrapper relative">
 *   <Image
 *     src={src}
 *     alt={alt}
 *     loading="lazy"
 *     onLoad={onLoad}
 *     className={`lazy-image ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
 *   />
 *   {!isLoaded && <Skeleton className="absolute inset-0" />}
 * </div>
 * ```
 */
export function useImageLoad() {
  const [isLoaded, setIsLoaded] = useState(false);

  const onLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return { isLoaded, onLoad };
}

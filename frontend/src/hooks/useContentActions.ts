'use client';

import { useState, useCallback } from 'react';

export interface ContentMeta {
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
}

export interface ContentActionsState extends ContentMeta {
  isPending: boolean;
  error: string | null;
}

/**
 * useContentActions - optimistic updates for content metadata actions.
 * Immediately updates local state on action, rolls back on API error.
 */
export function useContentActions(
  initial: ContentMeta,
  handlers: {
    onLike?: (liked: boolean) => Promise<void>;
  } = {},
) {
  const [state, setState] = useState<ContentActionsState>({
    ...initial,
    isPending: false,
    error: null,
  });

  const toggleLike = useCallback(async () => {
    const prev = state;
    const nextLiked = !state.isLiked;
    const delta = nextLiked ? 1 : -1;

    setState((s: ContentActionsState) => ({
      ...s,
      isLiked: nextLiked,
      likeCount: s.likeCount + delta,
      isPending: true,
      error: null,
    }));

    try {
      await handlers.onLike?.(nextLiked);
      setState((s: ContentActionsState) => ({ ...s, isPending: false }));
    } catch {
      setState({ ...prev, isPending: false, error: 'Failed to update like. Please try again.' });
    }
  }, [state, handlers]);

  const clearError = useCallback(() => {
    setState((s: ContentActionsState) => ({ ...s, error: null }));
  }, []);

  return { state, toggleLike, clearError };
}

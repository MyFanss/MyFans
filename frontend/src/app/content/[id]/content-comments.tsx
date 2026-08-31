'use client';

/**
 * Unlocked-only comments surface for a piece of content (#1610).
 *
 * Policy: comments belong to the gated surface. This component is mounted by
 * `ClientContent` *only* when the server has granted the current viewer
 * access — a locked viewer never sees the thread or the composer. See
 * `docs/CONTENT_ACCESS.md` for the full rationale.
 *
 * The thread list / submit wiring to the backend comments module is tracked
 * as follow-up work; this component intentionally ships without placeholder
 * comments so nothing fake is rendered in the meantime.
 */
export interface ContentCommentsProps {
  contentId: string;
  commentCount: number;
}

export function ContentComments({ contentId, commentCount }: ContentCommentsProps) {
  return (
    <section
      aria-label="Comments"
      data-content-id={contentId}
      className="max-w-4xl mx-auto px-4 mt-12 border-t border-gray-100 dark:border-gray-800 pt-8"
    >
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Comments
        <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          {commentCount}
        </span>
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        You have access to this content, so you can join the discussion.
      </p>
    </section>
  );
}

export default ContentComments;

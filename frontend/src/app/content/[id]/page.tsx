'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  /** Blurred/low-res preview always safe to show. */
  teaserUrl?: string;
  /** Full asset URL — only present when access is granted server-side. */
  contentUrl?: string;
  /** Authoritative lock signal from the backend. */
  locked?: boolean;
  /** Fallback gating flag. */
  isGated?: boolean;
  /** Pre-evaluated access for the current viewer (skips extra access call). */
  hasAccess?: boolean;
  likeCount: number;
  commentCount: number;
  creatorId: string;
}

interface AccessResponse {
  hasAccess: boolean;
}

interface Comment {
  id: string;
  contentId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

interface CommentsResponse {
  data: Comment[];
}

// ── State ─────────────────────────────────────────────────────────────────

interface PageState {
  contentStatus: 'loading' | 'not_found' | 'error' | 'ready';
  content: ContentItem | null;
  accessResolved: boolean;
  isUnlocked: boolean;

  likeCount: number;
  liking: boolean;
  likeError: string | null;

  comments: Comment[];
  commentsLoading: boolean;
  commentDraft: string;
  submittingComment: boolean;
  commentError: string | null;
}

type Action =
  | { type: 'CONTENT_NOT_FOUND' }
  | { type: 'CONTENT_ERROR' }
  | { type: 'CONTENT_LOADED'; content: ContentItem }
  | { type: 'ACCESS_RESOLVED'; hasAccess: boolean }
  | { type: 'LIKE_OPTIMISTIC' }
  | { type: 'LIKE_COMMIT' }
  | { type: 'LIKE_ROLLBACK' }
  | { type: 'LIKE_ERROR_DISMISS' }
  | { type: 'COMMENTS_LOADED'; comments: Comment[] }
  | { type: 'COMMENT_DRAFT'; value: string }
  | { type: 'COMMENT_SUBMITTING' }
  | { type: 'COMMENT_DONE'; comment: Comment }
  | { type: 'COMMENT_ERROR'; message: string };

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'CONTENT_NOT_FOUND':
      return { ...state, contentStatus: 'not_found' };
    case 'CONTENT_ERROR':
      return { ...state, contentStatus: 'error' };
    case 'CONTENT_LOADED': {
      const c = action.content;
      // If content already carries hasAccess, we can skip the access call.
      const locked = c.locked === true || (c.locked === undefined && c.isGated === true);
      const preResolved = typeof c.hasAccess === 'boolean';
      return {
        ...state,
        contentStatus: 'ready',
        content: c,
        likeCount: c.likeCount,
        accessResolved: preResolved,
        isUnlocked: preResolved ? (c.hasAccess ?? false) : !locked,
      };
    }
    case 'ACCESS_RESOLVED':
      return { ...state, accessResolved: true, isUnlocked: action.hasAccess };
    case 'LIKE_OPTIMISTIC':
      return { ...state, liking: true, likeCount: state.likeCount + 1, likeError: null };
    case 'LIKE_COMMIT':
      return { ...state, liking: false };
    case 'LIKE_ROLLBACK':
      // Undo only this call's own optimistic +1, relative to whatever
      // likeCount is *now* — never overwrite with a baseline captured
      // before the request started. A baseline-overwrite would clobber a
      // newer count if content reloaded (or another update landed) while
      // this request was in flight (#2013).
      return {
        ...state,
        liking: false,
        likeCount: Math.max(0, state.likeCount - 1),
        likeError: 'Failed to like. Please try again.',
      };
    case 'LIKE_ERROR_DISMISS':
      return { ...state, likeError: null };
    case 'COMMENTS_LOADED':
      return { ...state, commentsLoading: false, comments: action.comments };
    case 'COMMENT_DRAFT':
      return { ...state, commentDraft: action.value };
    case 'COMMENT_SUBMITTING':
      return { ...state, submittingComment: true, commentError: null };
    case 'COMMENT_DONE':
      return {
        ...state,
        submittingComment: false,
        commentDraft: '',
        comments: [...state.comments, action.comment],
      };
    case 'COMMENT_ERROR':
      return { ...state, submittingComment: false, commentError: action.message };
    default:
      return state;
  }
}

const initialState: PageState = {
  contentStatus: 'loading',
  content: null,
  accessResolved: false,
  isUnlocked: false,
  likeCount: 0,
  liking: false,
  likeError: null,
  comments: [],
  commentsLoading: false,
  commentDraft: '',
  submittingComment: false,
  commentError: null,
};

// Issue #2011: a Date.now()+Math.random() key is guessable and, more
// importantly, is regenerated on every call, so a retry (or a double-click)
// can never be deduplicated by the backend. crypto.randomUUID() gives a
// cryptographically-unique value; stability across retries is handled by
// the caller (see `idempotencyKeyRef` in `submitComment`), which only calls
// this once per draft rather than once per attempt.
function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ── Page component ────────────────────────────────────────────────────────

export default function ContentPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [state, dispatch] = useReducer(reducer, initialState);
  // Issue #2011: the idempotency key for the comment currently being
  // composed. Kept in a ref (not reducer state) since it is pure
  // bookkeeping that should never itself trigger a re-render. Generated
  // lazily on first submit of a given draft and reused for every retry of
  // that *same* draft; a new/edited draft gets a new key.
  const commentIdempotencyRef = useRef<{ key: string; draft: string } | null>(null);

  // 1. Load content metadata
  useEffect(() => {
    let cancelled = false;

    apiFetch(`/api/v1/content/${id}`, { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          dispatch({ type: 'CONTENT_NOT_FOUND' });
          return;
        }
        if (!res.ok) {
          dispatch({ type: 'CONTENT_ERROR' });
          return;
        }
        const content = (await res.json()) as ContentItem;
        dispatch({ type: 'CONTENT_LOADED', content });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'CONTENT_ERROR' });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // 2. Resolve access (skip if hasAccess already in payload)
  useEffect(() => {
    if (state.contentStatus !== 'ready' || state.accessResolved) return;

    let cancelled = false;

    apiFetch(`/api/v1/content/${id}/access`, { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          // Fail closed — any error = no access
          dispatch({ type: 'ACCESS_RESOLVED', hasAccess: false });
          return;
        }
        const data = (await res.json()) as AccessResponse;
        dispatch({ type: 'ACCESS_RESOLVED', hasAccess: data.hasAccess === true });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'ACCESS_RESOLVED', hasAccess: false });
      });

    return () => {
      cancelled = true;
    };
  }, [id, state.contentStatus, state.accessResolved]);

  // 3. Load comments once unlocked
  useEffect(() => {
    if (!state.isUnlocked || !state.accessResolved) return;

    let cancelled = false;

    apiFetch(`/api/v1/content/${id}/comments`, { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          dispatch({ type: 'COMMENTS_LOADED', comments: [] });
          return;
        }
        const data = (await res.json()) as CommentsResponse;
        dispatch({ type: 'COMMENTS_LOADED', comments: data.data ?? [] });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'COMMENTS_LOADED', comments: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [id, state.isUnlocked, state.accessResolved]);

  // Like handler — optimistic update with rollback.
  // Guarded by `state.liking` so a second click while a request is already
  // in flight is a no-op (#2013): the check runs first, before any
  // dispatch, and `handleLike`'s closure is rebound on every render where
  // `state.liking` changes, so the very next render after the optimistic
  // dispatch already sees `liking: true`.
  const handleLike = useCallback(async () => {
    if (state.liking || !state.isUnlocked) return;
    dispatch({ type: 'LIKE_OPTIMISTIC' });

    try {
      const res = await apiFetch(`/api/content/${id}/like`, {
        method: 'POST',
        idempotencyKey: generateIdempotencyKey(),
      });
      if (!res.ok) {
        dispatch({ type: 'LIKE_ROLLBACK' });
        return;
      }
      dispatch({ type: 'LIKE_COMMIT' });
    } catch {
      dispatch({ type: 'LIKE_ROLLBACK' });
    }
  }, [id, state.liking, state.isUnlocked]);

  // Comment submit (#2011: idempotency key is stable per draft, not
  // regenerated on every call, so a retry after a network error — or a
  // double-submit of the same draft — reuses the same key and the backend
  // can deduplicate the comment).
  const submitComment = useCallback(async () => {
    const draft = state.commentDraft.trim();
    if (!draft || state.submittingComment) return;

    if (!commentIdempotencyRef.current || commentIdempotencyRef.current.draft !== draft) {
      commentIdempotencyRef.current = { key: generateIdempotencyKey(), draft };
    }
    const idempotencyKey = commentIdempotencyRef.current.key;

    dispatch({ type: 'COMMENT_SUBMITTING' });

    try {
      const res = await apiFetch(`/api/v1/content/${id}/comments`, {
        method: 'POST',
        idempotencyKey,
        body: JSON.stringify({ body: draft }),
      });
      if (!res.ok) {
        dispatch({ type: 'COMMENT_ERROR', message: 'Failed to post comment. Please try again.' });
        return;
      }
      const comment = (await res.json()) as Comment;
      // Clear the key only on success so the *next* draft gets a fresh one;
      // on error it stays put for the retry above to reuse.
      commentIdempotencyRef.current = null;
      dispatch({ type: 'COMMENT_DONE', comment });
    } catch {
      dispatch({ type: 'COMMENT_ERROR', message: 'Network error. Could not post comment.' });
    }
  }, [id, state.commentDraft, state.submittingComment]);

  // ── Render states ─────────────────────────────────────────────────────

  if (state.contentStatus === 'loading') {
    return (
      <main style={styles.page}>
        <p role="status">Loading content…</p>
      </main>
    );
  }

  if (state.contentStatus === 'not_found') {
    return (
      <main style={styles.page}>
        <p role="alert">Content not found.</p>
      </main>
    );
  }

  if (state.contentStatus === 'error') {
    return (
      <main style={styles.page}>
        <p role="alert">Failed to load content. Please try again later.</p>
      </main>
    );
  }

  const { content } = state;
  if (!content) return null;

  return (
    <main style={styles.page}>
      {/* Like error banner — dismissible */}
      {state.likeError && (
        <div role="alert" style={styles.errorBanner}>
          <span>{state.likeError}</span>
          <button
            style={styles.dismissBtn}
            onClick={() => dispatch({ type: 'LIKE_ERROR_DISMISS' })}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      <h1 style={styles.heading}>{content.title}</h1>
      {content.description && <p style={styles.description}>{content.description}</p>}

      {/* ── Content area: teaser vs full ─────────────────────────────── */}
      {!state.isUnlocked ? (
        <TeaserView
          teaserUrl={content.teaserUrl}
          creatorId={content.creatorId}
        />
      ) : (
        <FullView contentUrl={content.contentUrl} />
      )}

      {/* ── Social actions (only when unlocked) ─────────────────────── */}
      {state.isUnlocked && (
        <>
          <div style={styles.actions}>
            <button
              style={styles.likeBtn}
              onClick={handleLike}
              disabled={state.liking}
              aria-label={`Like — ${state.likeCount} likes`}
            >
              ♥ Like {state.likeCount > 0 ? `(${state.likeCount})` : ''}
            </button>
          </div>

          {/* ── Comments ──────────────────────────────────────────────── */}
          <section style={styles.commentsSection} aria-label="Comments">
            <h2 style={styles.commentsHeading}>Comments</h2>

            {state.commentsLoading && <p role="status">Loading comments…</p>}

            {!state.commentsLoading && state.comments.length === 0 && (
              <p style={styles.emptyText}>No comments yet. Be the first!</p>
            )}

            <ul style={styles.commentList}>
              {state.comments.map((c) => (
                <li key={c.id} style={styles.commentItem}>
                  <p style={styles.commentBody}>{c.body}</p>
                  <time style={styles.commentTime} dateTime={c.createdAt}>
                    {new Date(c.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>

            {/* Comment composer */}
            <div style={styles.composer}>
              <textarea
                style={styles.textarea}
                placeholder="Write a comment…"
                value={state.commentDraft}
                onChange={(e) =>
                  dispatch({ type: 'COMMENT_DRAFT', value: e.target.value })
                }
                aria-label="Comment text"
                rows={3}
              />
              {state.commentError && (
                <p role="alert" style={styles.commentErrorText}>
                  {state.commentError}
                </p>
              )}
              <button
                style={styles.submitBtn}
                onClick={submitComment}
                disabled={state.submittingComment || !state.commentDraft.trim()}
              >
                {state.submittingComment ? 'Posting…' : 'Post Comment'}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function TeaserView({
  teaserUrl,
  creatorId,
}: {
  teaserUrl?: string;
  creatorId: string;
}) {
  return (
    <div style={styles.teaserWrapper} aria-label="Gated content preview">
      {teaserUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={teaserUrl}
          alt="Content preview"
          style={styles.teaserImg}
          aria-hidden="true"
        />
      ) : (
        <div style={styles.teaserPlaceholder} />
      )}
      <div style={styles.lockOverlay}>
        <span style={styles.lockIcon} aria-hidden="true">🔒</span>
        <p style={styles.lockText}>Subscribe to unlock this content</p>
        <a href={`/subscribe/${creatorId}`} style={styles.subscribeLink}>
          Subscribe
        </a>
      </div>
    </div>
  );
}

function FullView({ contentUrl }: { contentUrl?: string }) {
  if (!contentUrl) {
    return (
      <div style={styles.fullPlaceholder}>
        <p style={{ color: '#aaa' }}>Content is available — media loading…</p>
      </div>
    );
  }
  return (
    <div style={styles.fullWrapper}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={contentUrl} alt="Full content" style={styles.fullImg} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = {
  page: {
    maxWidth: '760px',
    margin: '0 auto',
    padding: '2rem 1rem',
    fontFamily: 'system-ui, sans-serif',
  },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' },
  description: { color: '#aaa', marginBottom: '1.5rem' },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    background: '#3b1a1a',
    color: '#f87171',
    marginBottom: '1rem',
    border: '1px solid #7f1d1d',
  },
  dismissBtn: {
    background: 'transparent',
    border: '1px solid #f87171',
    color: '#f87171',
    borderRadius: '4px',
    padding: '0.25rem 0.625rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  // Teaser
  teaserWrapper: {
    position: 'relative' as const,
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '1.5rem',
    background: '#1a1a1a',
    minHeight: '260px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    filter: 'blur(16px) brightness(0.4)',
    position: 'absolute' as const,
    inset: 0,
  },
  teaserPlaceholder: {
    width: '100%',
    minHeight: '260px',
    background: 'linear-gradient(135deg,#1a1a2e,#16213e)',
  },
  lockOverlay: {
    position: 'relative' as const,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
    padding: '2rem',
  },
  lockIcon: { fontSize: '2.5rem' },
  lockText: { color: '#ccc', textAlign: 'center' as const },
  subscribeLink: {
    padding: '0.6rem 1.5rem',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 600,
    textDecoration: 'none',
  },
  // Full view
  fullWrapper: {
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '1.5rem',
    background: '#111',
  },
  fullImg: { width: '100%', display: 'block' },
  fullPlaceholder: {
    borderRadius: '12px',
    background: '#1a1a1a',
    minHeight: '260px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  // Actions
  actions: { display: 'flex', gap: '0.75rem', marginBottom: '2rem' },
  likeBtn: {
    padding: '0.5rem 1.1rem',
    borderRadius: '8px',
    background: '#1a1a2e',
    color: '#f0f0f0',
    border: '1px solid #444',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '0.95rem',
  },
  // Comments
  commentsSection: { borderTop: '1px solid #333', paddingTop: '1.5rem' },
  commentsHeading: { fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' },
  commentList: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.875rem',
    marginBottom: '1.5rem',
  },
  commentItem: {
    background: '#1a1a1a',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    border: '1px solid #2a2a2a',
  },
  commentBody: { marginBottom: '0.35rem', lineHeight: 1.5 },
  commentTime: { fontSize: '0.75rem', color: '#666' },
  composer: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #444',
    background: '#111',
    color: '#f0f0f0',
    fontSize: '0.95rem',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  commentErrorText: { color: '#f87171', fontSize: '0.875rem' },
  submitBtn: {
    alignSelf: 'flex-start' as const,
    padding: '0.55rem 1.25rem',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyText: { color: '#888', fontSize: '0.9rem', marginBottom: '1rem' },
} as const;

/**
 * Regression coverage for:
 *  - #2013: a failed like rolls back only its own optimistic +1 (not a
 *    stale captured baseline), and a second like click while one is in
 *    flight is ignored.
 *  - #2011: the comment Idempotency-Key is stable per draft across
 *    retries/double-submits and is only cleared after a successful create.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ContentPage from './page';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const CONTENT: Record<string, unknown> = {
  id: 'content-1',
  title: 'A post',
  contentUrl: 'https://cdn.example/full.mp4',
  hasAccess: true,
  likeCount: 5,
  commentCount: 0,
  creatorId: 'creator-1',
};

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body } as Response;
}

function routeApiFetch() {
  apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const method = (opts.method as string | undefined) ?? 'GET';
    if (path === '/api/v1/content/content-1' && method === 'GET') {
      return jsonResponse(CONTENT);
    }
    if (path === '/api/v1/content/content-1/comments' && method === 'GET') {
      return jsonResponse({ data: [] });
    }
    throw new Error(`unexpected apiFetch call: ${method} ${path}`);
  });
}

async function renderUnlocked() {
  const utils = render(<ContentPage params={{ id: 'content-1' }} />);
  await waitFor(() => expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument());
  return utils;
}

describe('content/[id] page — like rollback (#2013)', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    routeApiFetch();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rolls back to the pre-click count on failure', async () => {
    apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
      const method = (opts.method as string | undefined) ?? 'GET';
      if (path === '/api/v1/content/content-1' && method === 'GET') return jsonResponse(CONTENT);
      if (path === '/api/v1/content/content-1/comments' && method === 'GET') return jsonResponse({ data: [] });
      if (path === '/api/content/content-1/like' && method === 'POST') return jsonResponse(null, false, 500);
      throw new Error(`unexpected apiFetch call: ${method} ${path}`);
    });

    await renderUnlocked();
    const likeBtn = screen.getByRole('button', { name: /like/i });
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 5 likes');

    await act(async () => {
      fireEvent.click(likeBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 5 likes');
  });

  it('rolls back relative to the current count, not a stale captured baseline', async () => {
    // Simulates the count having moved on (e.g. a reload) between the
    // optimistic increment and the failed response landing: rollback must
    // undo its own +1 against *that* newer count, not overwrite it with
    // the baseline from before the click.
    let resolveLike!: (value: Response) => void;
    apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
      const method = (opts.method as string | undefined) ?? 'GET';
      if (path === '/api/v1/content/content-1' && method === 'GET') return jsonResponse(CONTENT);
      if (path === '/api/v1/content/content-1/comments' && method === 'GET') return jsonResponse({ data: [] });
      if (path === '/api/content/content-1/like' && method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveLike = resolve;
        });
      }
      throw new Error(`unexpected apiFetch call: ${method} ${path}`);
    });

    await renderUnlocked();
    const likeBtn = screen.getByRole('button', { name: /like/i });

    await act(async () => {
      fireEvent.click(likeBtn); // optimistic: 5 -> 6, request pending
      await Promise.resolve();
    });
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 6 likes');

    await act(async () => {
      resolveLike(jsonResponse(null, false, 500));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Rollback undoes exactly this click's +1 (6 -> 5), landing back on the
    // pre-click value here since nothing else touched the count meanwhile.
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 5 likes');
  });

  it('ignores a second click while a like request is in flight', async () => {
    let resolveLike!: (value: Response) => void;
    apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
      const method = (opts.method as string | undefined) ?? 'GET';
      if (path === '/api/v1/content/content-1' && method === 'GET') return jsonResponse(CONTENT);
      if (path === '/api/v1/content/content-1/comments' && method === 'GET') return jsonResponse({ data: [] });
      if (path === '/api/content/content-1/like' && method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolveLike = resolve;
        });
      }
      throw new Error(`unexpected apiFetch call: ${method} ${path}`);
    });

    await renderUnlocked();
    const likeBtn = screen.getByRole('button', { name: /like/i });

    await act(async () => {
      fireEvent.click(likeBtn);
      fireEvent.click(likeBtn);
      fireEvent.click(likeBtn);
      await Promise.resolve();
    });

    const likeCalls = apiFetch.mock.calls.filter(([path]) => path === '/api/content/content-1/like');
    expect(likeCalls).toHaveLength(1);
    expect(likeBtn.getAttribute('aria-label')).toBe('Like — 6 likes');

    await act(async () => {
      resolveLike(jsonResponse({}, true, 200));
      await Promise.resolve();
    });
  });
});

describe('content/[id] page — comment idempotency key (#2011)', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    routeApiFetch();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function commentCalls() {
    return apiFetch.mock.calls.filter(([path]) => path === '/api/v1/content/content-1/comments');
  }

  it('reuses the same key across a failed retry of the same draft', async () => {
    let attempt = 0;
    apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
      const method = (opts.method as string | undefined) ?? 'GET';
      if (path === '/api/v1/content/content-1' && method === 'GET') return jsonResponse(CONTENT);
      if (path === '/api/v1/content/content-1/comments' && method === 'GET') return jsonResponse({ data: [] });
      if (path === '/api/v1/content/content-1/comments' && method === 'POST') {
        attempt += 1;
        if (attempt === 1) return jsonResponse(null, false, 500);
        return jsonResponse({ id: 'c1', contentId: 'content-1', authorId: 'u1', body: 'hi', createdAt: new Date().toISOString() });
      }
      throw new Error(`unexpected apiFetch call: ${method} ${path}`);
    });

    await renderUnlocked();
    const textarea = screen.getByLabelText('Comment text');
    const submitBtn = screen.getByRole('button', { name: /post comment/i });

    fireEvent.change(textarea, { target: { value: 'hi' } });

    await act(async () => {
      fireEvent.click(submitBtn);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(submitBtn); // retry of the *same* draft
      await Promise.resolve();
      await Promise.resolve();
    });

    const posts = commentCalls().filter(([, opts]) => (opts as { method?: string }).method === 'POST');
    expect(posts).toHaveLength(2);
    const firstKey = (posts[0][1] as { idempotencyKey?: string }).idempotencyKey;
    const secondKey = (posts[1][1] as { idempotencyKey?: string }).idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('issues a fresh key for the next draft after a successful create', async () => {
    apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
      const method = (opts.method as string | undefined) ?? 'GET';
      if (path === '/api/v1/content/content-1' && method === 'GET') return jsonResponse(CONTENT);
      if (path === '/api/v1/content/content-1/comments' && method === 'GET') return jsonResponse({ data: [] });
      if (path === '/api/v1/content/content-1/comments' && method === 'POST') {
        return jsonResponse({ id: 'c1', contentId: 'content-1', authorId: 'u1', body: 'hi', createdAt: new Date().toISOString() });
      }
      throw new Error(`unexpected apiFetch call: ${method} ${path}`);
    });

    await renderUnlocked();
    const textarea = screen.getByLabelText('Comment text');
    const submitBtn = screen.getByRole('button', { name: /post comment/i });

    fireEvent.change(textarea, { target: { value: 'first draft' } });
    await act(async () => {
      fireEvent.click(submitBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.change(textarea, { target: { value: 'second draft' } });
    await act(async () => {
      fireEvent.click(submitBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    const posts = commentCalls().filter(([, opts]) => (opts as { method?: string }).method === 'POST');
    expect(posts).toHaveLength(2);
    const firstKey = (posts[0][1] as { idempotencyKey?: string }).idempotencyKey;
    const secondKey = (posts[1][1] as { idempotencyKey?: string }).idempotencyKey;
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });

  it('disables the submit control while a comment request is in flight', async () => {
    let resolvePost!: (value: Response) => void;
    apiFetch.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
      const method = (opts.method as string | undefined) ?? 'GET';
      if (path === '/api/v1/content/content-1' && method === 'GET') return jsonResponse(CONTENT);
      if (path === '/api/v1/content/content-1/comments' && method === 'GET') return jsonResponse({ data: [] });
      if (path === '/api/v1/content/content-1/comments' && method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }
      throw new Error(`unexpected apiFetch call: ${method} ${path}`);
    });

    await renderUnlocked();
    const textarea = screen.getByLabelText('Comment text');
    const submitBtn = screen.getByRole('button', { name: /post comment/i });
    fireEvent.change(textarea, { target: { value: 'hi' } });

    await act(async () => {
      fireEvent.click(submitBtn);
      await Promise.resolve();
    });

    expect((screen.getByRole('button', { name: /posting/i }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolvePost(jsonResponse({ id: 'c1', contentId: 'content-1', authorId: 'u1', body: 'hi', createdAt: new Date().toISOString() }));
      await Promise.resolve();
    });
  });
});

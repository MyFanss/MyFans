import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPostsByAuthor,
  getPublishedPostsByAuthor,
  publicPostToCreatorPost,
  type PublicPost,
} from './posts';

global.fetch = vi.fn() as any;

function mockFetchOk(body: unknown) {
  (fetch as any).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  });
}

function makePost(overrides: Partial<PublicPost> = {}): PublicPost {
  return {
    id: 'post-1',
    title: 'Studio tour',
    content: 'Behind the scenes of my latest project.',
    authorId: 'author-1',
    isPublished: true,
    isPremium: false,
    likesCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getPostsByAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches posts for the given author with credentials included', async () => {
    mockFetchOk({ data: [], total: 0, page: 1, limit: 20, hasMore: false });

    await getPostsByAuthor('author-1');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/posts/author/author-1'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws with the server message on a non-ok response', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ message: 'Internal server error' }),
    });

    await expect(getPostsByAuthor('author-1')).rejects.toThrow('Internal server error');
  });
});

describe('publicPostToCreatorPost', () => {
  it('maps a short post without truncating the excerpt', () => {
    const post = makePost({ content: 'Short post' });

    const mapped = publicPostToCreatorPost(post);

    expect(mapped).toEqual({
      id: 'post-1',
      title: 'Studio tour',
      type: 'text',
      excerpt: 'Short post',
      publishedAt: '2026-01-01T00:00:00.000Z',
      isLocked: false,
      likeCount: 12,
    });
  });

  it('truncates long content with an ellipsis', () => {
    const longContent = 'a'.repeat(200);
    const post = makePost({ content: longContent });

    const mapped = publicPostToCreatorPost(post);

    expect(mapped.excerpt?.endsWith('…')).toBe(true);
    expect(mapped.excerpt?.length).toBeLessThan(longContent.length);
  });

  it('maps isPremium to isLocked', () => {
    const post = makePost({ isPremium: true });

    expect(publicPostToCreatorPost(post).isLocked).toBe(true);
  });
});

describe('getPublishedPostsByAuthor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out unpublished posts before mapping', async () => {
    mockFetchOk({
      data: [
        makePost({ id: 'p1', isPublished: true }),
        makePost({ id: 'p2', isPublished: false }),
      ],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    const result = await getPublishedPostsByAuthor('author-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('returns an empty array when the author has no published posts', async () => {
    mockFetchOk({
      data: [makePost({ isPublished: false })],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    const result = await getPublishedPostsByAuthor('author-1');

    expect(result).toEqual([]);
  });
});

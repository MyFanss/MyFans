import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFeed } from './feed';

const mockPosts = [
  {
    id: 'post-1',
    title: 'My First Post',
    content: 'This is content for my first post',
    authorId: 'creator-1',
    isPublished: true,
    isPremium: false,
    likesCount: 10,
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'post-2',
    title: 'Premium Content',
    content: 'This is subscriber-only content',
    authorId: 'creator-2',
    isPublished: true,
    isPremium: true,
    likesCount: 25,
    createdAt: '2025-01-02T00:00:00Z',
  },
];

describe('feed API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches feed with default parameters', async () => {
    const mockResponse = {
      data: mockPosts,
      cursor: null,
      nextCursor: 'cursor-123',
      total: 100,
      hasMore: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getFeed();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/feed/subscriptions'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('fetches feed with cursor pagination', async () => {
    const mockResponse = {
      data: [mockPosts[1]],
      cursor: 'cursor-123',
      nextCursor: null,
      total: 100,
      hasMore: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getFeed({
      cursor: 'cursor-123',
      limit: 10,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cursor=cursor-123'),
      expect.any(Object),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=10'),
      expect.any(Object),
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws error on failed request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    await expect(getFeed()).rejects.toThrow('Unauthorized');
  });

  it('handles network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(getFeed()).rejects.toThrow('Network error');
  });

  it('returns empty feed when no subscriptions', async () => {
    const mockResponse = {
      data: [],
      cursor: null,
      nextCursor: null,
      total: 0,
      hasMore: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getFeed();

    expect(result.data).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

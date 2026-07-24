import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCreatorProfile, publicCreatorToProfile, type PublicCreator } from './creators';

global.fetch = vi.fn() as any;

function mockFetchOk(body: unknown) {
  (fetch as any).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchStatus(status: number, body: unknown = {}) {
  (fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

describe('getCreatorProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the creator by exact username with credentials included', async () => {
    const creator: PublicCreator = {
      id: '1',
      username: 'jane',
      display_name: 'Jane Doe',
      avatar_url: null,
      bio: 'Digital artist',
      is_verified: true,
      followers_count: 42,
    };
    mockFetchOk(creator);

    const result = await getCreatorProfile('jane');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/creators/username/jane'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(result).toEqual(creator);
  });

  it('URL-encodes the username', async () => {
    mockFetchOk({});

    await getCreatorProfile('jane doe');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/creators/username/jane%20doe'),
      expect.anything(),
    );
  });

  it('returns null for an unknown username (404)', async () => {
    mockFetchStatus(404);

    const result = await getCreatorProfile('nobody');

    expect(result).toBeNull();
  });

  it('throws on a non-404 error response', async () => {
    mockFetchStatus(500, { message: 'Internal server error' });

    await expect(getCreatorProfile('jane')).rejects.toThrow('Internal server error');
  });
});

describe('publicCreatorToProfile', () => {
  it('maps API fields to the CreatorProfile shape used by the UI', () => {
    const creator: PublicCreator = {
      id: '1',
      username: 'jane',
      display_name: 'Jane Doe',
      avatar_url: 'https://example.com/jane.jpg',
      bio: 'Digital artist',
      is_verified: true,
      followers_count: 12400,
    };

    const profile = publicCreatorToProfile(creator);

    expect(profile).toEqual({
      id: '1',
      username: 'jane',
      displayName: 'Jane Doe',
      bio: 'Digital artist',
      avatarUrl: 'https://example.com/jane.jpg',
      subscriberCount: 12400,
      subscriptionPrice: 0,
      isVerified: true,
      categories: [],
      socialLinks: [],
    });
  });

  it('falls back to empty bio and undefined avatar when null', () => {
    const creator: PublicCreator = {
      id: '2',
      username: 'alex',
      display_name: 'Alex Chen',
      avatar_url: null,
      bio: null,
      is_verified: false,
      followers_count: 0,
    };

    const profile = publicCreatorToProfile(creator);

    expect(profile.bio).toBe('');
    expect(profile.avatarUrl).toBeUndefined();
  });
});

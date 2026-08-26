import { describe, it, expect, vi, beforeEach } from 'vitest';
import { joinGame, startGame, listGames, type Game } from './games';

global.fetch = vi.fn() as any;

function mockFetchOk(body: unknown, status = 200) {
  (fetch as any).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'game-1',
    title: 'Card Game',
    description: 'A fun card game',
    status: 'PENDING',
    maxPlayers: 4,
    currentPlayers: 1,
    hostUserId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('joinGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes x-csrf-token header when csrfToken is provided', async () => {
    mockFetchOk({ success: true });

    await joinGame('game-1', 'csrf-token-123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/games/game-1/join'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf-token-123',
        }),
      }),
    );
  });

  it('throws with Unauthorized message on 401 response', async () => {
    mockFetchOk({}, 401);

    await expect(joinGame('game-1', 'csrf-token')).rejects.toThrow('Unauthorized');
  });

  it('throws with server message on error response', async () => {
    mockFetchOk({ message: 'Game not found' }, 404);

    await expect(joinGame('game-1', 'csrf-token')).rejects.toThrow('Game not found');
  });
});

describe('startGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes x-csrf-token header when csrfToken is provided', async () => {
    mockFetchOk(makeGame({ status: 'ACTIVE' }));

    await startGame('game-1', {}, 'csrf-token-123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/games/game-1/start'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf-token-123',
        }),
      }),
    );
  });

  it('includes idempotency-key header when provided', async () => {
    mockFetchOk(makeGame({ status: 'ACTIVE' }));

    await startGame('game-1', { idempotencyKey: 'idempotency-123' }, 'csrf-token-123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/games/game-1/start'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'idempotency-key': 'idempotency-123',
        }),
      }),
    );
  });

  it('throws with "Only the host can start the game" on 403 response', async () => {
    mockFetchOk({}, 403);

    await expect(startGame('game-1', {}, 'csrf-token')).rejects.toThrow(
      'Only the host can start the game',
    );
  });

  it('throws with Unauthorized message on 401 response', async () => {
    mockFetchOk({}, 401);

    await expect(startGame('game-1', {}, 'csrf-token')).rejects.toThrow('Unauthorized');
  });
});

describe('listGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches games with credentials included', async () => {
    const game = makeGame();
    mockFetchOk({ data: [game], limit: 20, nextCursor: null, hasMore: false });

    await listGames({ limit: 20 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/games'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('includes status filter in query params', async () => {
    mockFetchOk({ data: [], limit: 20, nextCursor: null, hasMore: false });

    await listGames({ status: 'ACTIVE', limit: 20 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=ACTIVE'),
      expect.any(Object),
    );
  });
});

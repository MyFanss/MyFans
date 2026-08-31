import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMessage, listConversations, type Conversation } from './messages';

global.fetch = vi.fn() as any;

function mockFetchOk(body: unknown, status = 200) {
  (fetch as any).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    participant1Id: 'user-1',
    participant2Id: 'user-2',
    participant1: {
      id: 'user-1',
      username: 'alice',
      displayName: 'Alice',
    },
    participant2: {
      id: 'user-2',
      username: 'bob',
      displayName: 'Bob',
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes x-csrf-token header when csrfToken is provided', async () => {
    mockFetchOk({ id: 'msg-1', conversationId: 'conv-1', senderId: 'user-1', content: 'Hello', isRead: false, createdAt: '2026-01-01T00:00:00.000Z' });

    await sendMessage('conv-1', { content: 'Hello' }, 'csrf-token-123');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/conversations/conv-1/messages'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf-token-123',
        }),
      }),
    );
  });

  it('includes idempotency-key header when provided', async () => {
    mockFetchOk({ id: 'msg-1', conversationId: 'conv-1', senderId: 'user-1', content: 'Hello', isRead: false, createdAt: '2026-01-01T00:00:00.000Z' });

    await sendMessage(
      'conv-1',
      { content: 'Hello', idempotencyKey: 'idempotency-123' },
      'csrf-token-123',
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/conversations/conv-1/messages'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'idempotency-key': 'idempotency-123',
        }),
      }),
    );
  });

  it('throws with Unauthorized message on 401 response', async () => {
    mockFetchOk({}, 401);

    await expect(sendMessage('conv-1', { content: 'Hello' }, 'csrf-token')).rejects.toThrow('Unauthorized');
  });

  it('throws with server message on error response', async () => {
    mockFetchOk({ message: 'Internal server error' }, 500);

    await expect(sendMessage('conv-1', { content: 'Hello' }, 'csrf-token')).rejects.toThrow('Internal server error');
  });
});

describe('listConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches conversations with credentials included', async () => {
    const conv = makeConversation();
    mockFetchOk({ data: [conv], limit: 20, nextCursor: null, hasMore: false });

    await listConversations({ limit: 20 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/conversations'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('includes cursor in query params', async () => {
    mockFetchOk({ data: [], limit: 20, nextCursor: null, hasMore: false });

    await listConversations({ cursor: 'cursor-123', limit: 20 });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cursor=cursor-123'),
      expect.any(Object),
    );
  });
});

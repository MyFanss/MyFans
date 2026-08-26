/**
 * Messages/Conversations API client.
 */
import { getApiBaseUrl } from '@/lib/api/base-url';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  participant2?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  lastMessage?: Message;
  lastMessageId?: string;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationsPage {
  data: Conversation[];
  limit: number;
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface MessagesPage {
  data: Message[];
  limit: number;
  nextCursor?: string | null;
  hasMore: boolean;
}

const API_BASE = `${getApiBaseUrl()}/api/v1`;
const idempotencyKey = () => globalThis.crypto.randomUUID();

/**
 * List user conversations with cursor-based pagination.
 */
export async function listConversations(params: {
  cursor?: string;
  limit?: number;
} = {}): Promise<ConversationsPage> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/conversations?${qs.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<ConversationsPage>;
}

/**
 * Get a single conversation by ID.
 * Returns null when conversation is not found.
 */
export async function getConversationById(id: string): Promise<Conversation | null> {
  const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<Conversation>;
}

/**
 * Create a new conversation with a participant.
 */
export async function createConversation(params: {
  participant2Id: string;
}): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<Conversation>;
}

/**
 * List messages in a conversation with cursor-based pagination.
 */
export async function listMessages(
  conversationId: string,
  params: {
    cursor?: string;
    limit?: number;
  } = {},
): Promise<MessagesPage> {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages?${qs.toString()}`, {
    credentials: 'include',
  });
  if (res.status === 404) {
    throw new Error('Conversation not found');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<MessagesPage>;
}

/**
 * Send a message in a conversation.
 */
export async function sendMessage(
  conversationId: string,
  params: {
    content: string;
  },
): Promise<Message> {
  const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(),
    },
    body: JSON.stringify(params),
  });
  if (res.status === 404) {
    throw new Error('Conversation not found');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<Message>;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (res.status === 404) {
    throw new Error('Conversation not found');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Request failed: ${res.status}`);
  }
}

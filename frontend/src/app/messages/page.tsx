'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api/client';

// ── Typed models ──────────────────────────────────────────────────────────

interface Participant {
  id: string;
  username: string;
  displayName: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1: Participant;
  participant2: Participant;
  lastMessage: Message | null;
  updatedAt: string;
  createdAt: string;
}

interface ConversationListResponse {
  data: Conversation[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

interface MessageListResponse {
  data: Message[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

// ── State ────────────────────────────────────────────────────────────────

type PageState =
  | { status: 'loading' }
  | { status: 'unauth' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      conversations: Conversation[];
      activeId: string | null;
      messages: Message[];
      threadLoading: boolean;
      sending: boolean;
    };

type Action =
  | { type: 'LOAD_UNAUTH' }
  | { type: 'LOAD_ERROR'; message: string }
  | { type: 'LOAD_SUCCESS'; conversations: Conversation[] }
  | { type: 'SELECT_CONVERSATION'; id: string }
  | { type: 'MESSAGES_LOADED'; messages: Message[] }
  | { type: 'SENDING' }
  | { type: 'SEND_DONE'; message: Message }
  | { type: 'SEND_FAIL' };

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case 'LOAD_UNAUTH':
      return { status: 'unauth' };
    case 'LOAD_ERROR':
      return { status: 'error', message: action.message };
    case 'LOAD_SUCCESS':
      return {
        status: 'ready',
        conversations: action.conversations,
        activeId: null,
        messages: [],
        threadLoading: false,
        sending: false,
      };
    case 'SELECT_CONVERSATION':
      if (state.status !== 'ready') return state;
      return { ...state, activeId: action.id, messages: [], threadLoading: true };
    case 'MESSAGES_LOADED':
      if (state.status !== 'ready') return state;
      return { ...state, messages: action.messages, threadLoading: false };
    case 'SENDING':
      if (state.status !== 'ready') return state;
      return { ...state, sending: true };
    case 'SEND_DONE':
      if (state.status !== 'ready') return state;
      return { ...state, sending: false, messages: [...state.messages, action.message] };
    case 'SEND_FAIL':
      if (state.status !== 'ready') return state;
      return { ...state, sending: false };
    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Escape a string for safe text-only rendering.
 * React's JSX already prevents XSS when using {text}, but this makes the
 * intent explicit and guards against dangerouslySetInnerHTML misuse.
 */
function escapeText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function getOtherParticipant(conv: Conversation, _currentUserId?: string): Participant {
  // Without a session, default to participant2 as the "other" party.
  return conv.participant2;
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [state, dispatch] = useReducer(reducer, { status: 'loading' } as PageState);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversations on mount
  useEffect(() => {
    let cancelled = false;

    apiFetch('/api/v1/conversations', { method: 'GET' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          dispatch({ type: 'LOAD_UNAUTH' });
          return;
        }
        if (!res.ok) {
          dispatch({ type: 'LOAD_ERROR', message: `Failed to load conversations (${res.status})` });
          return;
        }
        const data = (await res.json()) as ConversationListResponse;
        dispatch({ type: 'LOAD_SUCCESS', conversations: data.data ?? [] });
      })
      .catch(() => {
        if (!cancelled)
          dispatch({ type: 'LOAD_ERROR', message: 'Network error loading conversations.' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load messages when active conversation changes
  const selectConversation = useCallback(
    async (id: string) => {
      dispatch({ type: 'SELECT_CONVERSATION', id });

      try {
        const res = await apiFetch(`/api/v1/conversations/${id}/messages`, { method: 'GET' });
        if (!res.ok) {
          dispatch({ type: 'MESSAGES_LOADED', messages: [] });
          return;
        }
        const data = (await res.json()) as MessageListResponse;
        dispatch({ type: 'MESSAGES_LOADED', messages: data.data ?? [] });
      } catch {
        dispatch({ type: 'MESSAGES_LOADED', messages: [] });
      }
    },
    [],
  );

  const sendMessage = useCallback(async () => {
    if (state.status !== 'ready' || !state.activeId || !inputRef.current) return;
    const content = inputRef.current.value.trim();
    if (!content) return;

    dispatch({ type: 'SENDING' });
    inputRef.current.value = '';

    try {
      const res = await apiFetch(`/api/v1/conversations/${state.activeId}/messages`, {
        method: 'POST',
        idempotencyKey: generateIdempotencyKey(),
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        dispatch({ type: 'SEND_FAIL' });
        return;
      }
      const msg = (await res.json()) as Message;
      dispatch({ type: 'SEND_DONE', message: msg });
    } catch {
      dispatch({ type: 'SEND_FAIL' });
    }
  }, [state]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (state.status === 'loading') {
    return (
      <main style={styles.page}>
        <p role="status">Loading messages…</p>
      </main>
    );
  }

  if (state.status === 'unauth') {
    return (
      <main style={styles.page}>
        <p>You must be signed in to view messages. Please sign in to continue.</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main style={styles.page}>
        <p role="alert">{state.message}</p>
      </main>
    );
  }

  const activeConv = state.conversations.find((c) => c.id === state.activeId) ?? null;

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Messages</h1>
      <div style={styles.layout}>
        {/* Conversation list */}
        <aside style={styles.sidebar}>
          {state.conversations.length === 0 && (
            <p style={styles.emptyText}>No conversations yet.</p>
          )}
          <ul style={styles.convList}>
            {state.conversations.map((conv) => {
              const other = getOtherParticipant(conv);
              return (
                <li key={conv.id}>
                  <button
                    style={{
                      ...styles.convBtn,
                      ...(state.activeId === conv.id ? styles.convBtnActive : {}),
                    }}
                    onClick={() => selectConversation(conv.id)}
                  >
                    <span style={styles.convName}>{other.displayName}</span>
                    {conv.lastMessage && (
                      <span style={styles.convPreview}>
                        {/* XSS-safe: rendered as text, not HTML */}
                        {escapeText(conv.lastMessage.content).slice(0, 50)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Thread / message area */}
        <section style={styles.thread} aria-label="Message thread">
          {!activeConv ? (
            <p style={styles.emptyText}>Select a conversation to read messages.</p>
          ) : (
            <>
              <header style={styles.threadHeader}>
                <strong>{getOtherParticipant(activeConv).displayName}</strong>
              </header>

              <div style={styles.messageList} role="log" aria-live="polite">
                {state.threadLoading && <p role="status">Loading…</p>}
                {!state.threadLoading &&
                  state.messages.map((msg) => (
                    <div key={msg.id} style={styles.messageBubble}>
                      {/*
                       * XSS-safe: React renders this as a text node, not innerHTML.
                       * escapeText() is called explicitly to make the intent clear
                       * and to guard against any future dangerouslySetInnerHTML use.
                       */}
                      <span>{escapeText(msg.content)}</span>
                      <time style={styles.messageTime} dateTime={msg.createdAt}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </time>
                    </div>
                  ))}
              </div>

              <div style={styles.composer}>
                <input
                  ref={inputRef}
                  style={styles.input}
                  type="text"
                  placeholder="Type a message..."
                  aria-label="Message input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button
                  style={styles.sendBtn}
                  onClick={sendMessage}
                  disabled={state.sending}
                  aria-label="Send message"
                >
                  {state.sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = {
  page: { maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' },
  layout: { display: 'flex', gap: '1rem', height: '70vh', minHeight: '400px' },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    borderRight: '1px solid #333',
    paddingRight: '1rem',
    overflowY: 'auto' as const,
  },
  convList: { listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  convBtn: {
    width: '100%',
    textAlign: 'left' as const,
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '0.6rem 0.75rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    color: '#f0f0f0',
  },
  convBtnActive: { background: '#1e1e2e' },
  convName: { fontWeight: 600, fontSize: '0.95rem' },
  convPreview: { fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  thread: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  threadHeader: { padding: '0.75rem 0', borderBottom: '1px solid #333', marginBottom: '0.5rem' },
  messageList: { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', padding: '0.5rem 0' },
  messageBubble: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignSelf: 'flex-start' as const,
    background: '#1a1a2e',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    maxWidth: '75%',
    wordBreak: 'break-word' as const,
  },
  messageTime: { fontSize: '0.7rem', color: '#666', marginTop: '2px' },
  composer: { display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #333' },
  input: {
    flex: 1,
    padding: '0.6rem 0.875rem',
    borderRadius: '8px',
    border: '1px solid #444',
    background: '#111',
    color: '#f0f0f0',
    fontSize: '0.95rem',
  },
  sendBtn: {
    padding: '0.6rem 1.25rem',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyText: { color: '#888', fontSize: '0.9rem' },
} as const;

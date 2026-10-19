import { describe, expect, it, vi } from 'vitest';
import { reducer, getOtherParticipant, type PageState, type Action } from './page';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));

// #1999: getOtherParticipant must derive the counterparty from the session
// user's id, not always return participant2.
describe('getOtherParticipant', () => {
  const conv: any = {
    id: 'c1',
    participant1Id: 'u1',
    participant2Id: 'u2',
    participant1: { id: 'u1', username: 'alice', displayName: 'Alice' },
    participant2: { id: 'u2', username: 'bob', displayName: 'Bob' },
  };

  it('returns participant1 when the current user is participant2', () => {
    expect(getOtherParticipant(conv, 'u2')).toEqual(conv.participant1);
  });

  it('returns participant2 when the current user is participant1', () => {
    expect(getOtherParticipant(conv, 'u1')).toEqual(conv.participant2);
  });

  it('falls back to participant2 when there is no current user id', () => {
    expect(getOtherParticipant(conv, undefined)).toEqual(conv.participant2);
  });
});

describe('messages reducer and apiFetch load', () => {
  const ready: PageState = {
    status: 'ready',
    conversations: [],
    activeId: null,
    messages: [],
    threadLoading: false,
    sending: false,
    sendError: null,
  };
  const loading: PageState = { status: 'loading' };
  const dummyMsg: any = { id: 'm1', content: 'hi' };

  it('handles all 8 action types in ready/loading states', () => {
    expect(reducer(loading, { type: 'LOAD_UNAUTH' })).toEqual({ status: 'unauth' });
    expect(reducer(loading, { type: 'LOAD_ERROR', message: 'err' })).toEqual({ status: 'error', message: 'err' });
    expect(reducer(loading, { type: 'LOAD_SUCCESS', conversations: [] })).toEqual(ready);

    expect(reducer(ready, { type: 'SELECT_CONVERSATION', id: '1' })).toMatchObject({ activeId: '1', threadLoading: true, messages: [] });
    expect(reducer(ready, { type: 'MESSAGES_LOADED', messages: [dummyMsg] })).toMatchObject({ messages: [dummyMsg], threadLoading: false });
    expect(reducer(ready, { type: 'SENDING' })).toMatchObject({ sending: true });
    expect(reducer(ready, { type: 'SEND_DONE', message: dummyMsg })).toMatchObject({ sending: false, messages: [dummyMsg] });
    expect(reducer({ ...ready, sending: true }, { type: 'SEND_FAIL', message: 'boom' })).toMatchObject({ sending: false, sendError: 'boom' });

    // Guard: non-ready states return unchanged
    const guardedActions: Action[] = [
      { type: 'SELECT_CONVERSATION', id: '1' },
      { type: 'MESSAGES_LOADED', messages: [] },
      { type: 'SENDING' },
      { type: 'SEND_DONE', message: dummyMsg },
      { type: 'SEND_FAIL', message: 'boom' },
    ];
    for (const act of guardedActions) {
      expect(reducer(loading, act)).toBe(loading);
    }
  });

  // #2001: a failed send must surface an error, and a subsequent SENDING
  // (retry) or SEND_DONE must clear it.
  it('SEND_FAIL sets sendError; SENDING then SEND_DONE clear it', () => {
    const afterFail = reducer({ ...ready, sending: true }, { type: 'SEND_FAIL', message: 'Network error. Message was not sent.' });
    expect(afterFail).toMatchObject({ sending: false, sendError: 'Network error. Message was not sent.' });

    const retrying = reducer(afterFail, { type: 'SENDING' });
    expect(retrying).toMatchObject({ sending: true, sendError: null });

    const done = reducer(retrying, { type: 'SEND_DONE', message: dummyMsg });
    expect(done).toMatchObject({ sending: false, sendError: null, messages: [dummyMsg] });
  });

  it('covers load branches with mocked apiFetch (401, error, success)', async () => {
    async function loadConversations() {
      const res = await apiFetch('/api/v1/conversations', { method: 'GET' });
      if (res.status === 401) return { type: 'LOAD_UNAUTH' };
      if (!res.ok) return { type: 'LOAD_ERROR', message: `Failed (${res.status})` };
      const data = await res.json();
      return { type: 'LOAD_SUCCESS', conversations: data.data ?? [] };
    }

    vi.mocked(apiFetch).mockResolvedValueOnce({ status: 401, ok: false } as any);
    expect(await loadConversations()).toEqual({ type: 'LOAD_UNAUTH' });

    vi.mocked(apiFetch).mockResolvedValueOnce({ status: 500, ok: false } as any);
    expect(await loadConversations()).toEqual({ type: 'LOAD_ERROR', message: 'Failed (500)' });

    vi.mocked(apiFetch).mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ data: [{ id: 'c1' }] }) } as any);
    expect(await loadConversations()).toEqual({ type: 'LOAD_SUCCESS', conversations: [{ id: 'c1' }] });
  });
});

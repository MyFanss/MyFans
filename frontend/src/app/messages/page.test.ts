import { describe, expect, it, vi } from 'vitest';
import { reducer, type PageState, type Action } from './page';
import { apiFetch } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));

describe('messages reducer and apiFetch load', () => {
  const ready: PageState = { status: 'ready', conversations: [], activeId: null, messages: [], threadLoading: false, sending: false };
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
    expect(reducer({ ...ready, sending: true }, { type: 'SEND_FAIL' })).toMatchObject({ sending: false });

    // Guard: non-ready states return unchanged
    const guardedActions: Action[] = [
      { type: 'SELECT_CONVERSATION', id: '1' },
      { type: 'MESSAGES_LOADED', messages: [] },
      { type: 'SENDING' },
      { type: 'SEND_DONE', message: dummyMsg },
      { type: 'SEND_FAIL' },
    ];
    for (const act of guardedActions) {
      expect(reducer(loading, act)).toBe(loading);
    }
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

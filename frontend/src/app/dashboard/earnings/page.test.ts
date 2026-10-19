import { describe, expect, it } from 'vitest';
import { reducer, initialState, type Action } from './page';

describe('earnings dashboard reducer', () => {
  it('BALANCES_LOADED stores balances and clears loading/error', () => {
    const balances = [{ asset: 'USDC', available: '10', pending: '0', currency: 'USDC' }];
    const state = reducer(initialState, { type: 'BALANCES_LOADED', balances } as Action);

    expect(state.balances).toEqual(balances);
    expect(state.balancesLoading).toBe(false);
    expect(state.balancesError).toBeNull();
  });

  it('HISTORY_LOADED with append: true appends without dropping existing entries', () => {
    const e1 = { id: '1', amount: '1', asset: 'USDC', type: 'tip' as const, status: 'confirmed', createdAt: '2026-01-01T00:00:00.000Z' };
    const e2 = { id: '2', amount: '2', asset: 'USDC', type: 'tip' as const, status: 'confirmed', createdAt: '2026-01-02T00:00:00.000Z' };

    const page1 = reducer(initialState, {
      type: 'HISTORY_LOADED',
      entries: [e1],
      cursor: 'c1',
      append: false,
    } as Action);
    const page2 = reducer(page1, {
      type: 'HISTORY_LOADED',
      entries: [e2],
      cursor: null,
      append: true,
    } as Action);

    expect(page2.history.map((e) => e.id)).toEqual(['1', '2']);
    expect(page2.historyHasMore).toBe(false);
  });

  it('WITHDRAW_PREPARING -> SIGNING -> CONFIRMING -> DONE transitions the step machine', () => {
    const preparing = reducer(initialState, { type: 'WITHDRAW_PREPARING' } as Action);
    expect(preparing.withdrawStep).toBe('preparing');

    const signing = reducer(preparing, { type: 'WITHDRAW_SIGNING', xdr: 'xdr-1' } as Action);
    expect(signing.withdrawStep).toBe('signing');
    expect(signing.pendingXdr).toBe('xdr-1');

    const confirming = reducer(signing, { type: 'WITHDRAW_CONFIRMING', signedXdr: 'signed-xdr-1' } as Action);
    expect(confirming.withdrawStep).toBe('confirming');

    const done = reducer(confirming, {
      type: 'WITHDRAW_DONE',
      result: { amount: '10', asset: 'USDC', txHash: null },
    } as Action);
    expect(done.withdrawStep).toBe('done');
    expect(done.withdrawResult).toEqual({ amount: '10', asset: 'USDC', txHash: null });
    // The signed/pending XDR must not survive into the done state.
    expect(done.pendingXdr).toBeNull();
  });

  it('WITHDRAW_ERROR clears pendingXdr and returns to idle', () => {
    const signing = reducer(initialState, { type: 'WITHDRAW_SIGNING', xdr: 'xdr-1' } as Action);
    const errored = reducer(signing, { type: 'WITHDRAW_ERROR', message: 'boom' } as Action);

    expect(errored.withdrawStep).toBe('idle');
    expect(errored.withdrawError).toBe('boom');
    expect(errored.pendingXdr).toBeNull();
  });

  it('WITHDRAW_RESET after a signed-but-not-confirmed withdraw clears pendingXdr, error and result', () => {
    // #2018 regression: a withdraw that gets as far as `signing` (so
    // `pendingXdr` is populated) and is then reset/abandoned must not leave
    // a stale XDR sitting in state that a later "confirm" could reuse.
    const signing = reducer(initialState, { type: 'WITHDRAW_SIGNING', xdr: 'stale-xdr' } as Action);
    expect(signing.pendingXdr).toBe('stale-xdr');

    const reset = reducer(signing, { type: 'WITHDRAW_RESET' } as Action);

    expect(reset.pendingXdr).toBeNull();
    expect(reset.withdrawError).toBeNull();
    expect(reset.withdrawResult).toBeNull();
    expect(reset.withdrawStep).toBe('idle');
  });

  it('UNAUTHORIZED stops both balances and history loading', () => {
    const state = reducer(initialState, { type: 'UNAUTHORIZED' } as Action);
    expect(state.unauthorized).toBe(true);
    expect(state.balancesLoading).toBe(false);
    expect(state.historyLoading).toBe(false);
  });
});

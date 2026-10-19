import { describe, it, expect } from 'vitest';
import { reducer, initialState, type Game, type PageState } from './page';

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: 'g1',
    title: 'Trivia Night',
    description: 'Weekly trivia',
    status: 'PENDING',
    maxPlayers: 8,
    currentPlayers: 1,
    hostUserId: 'u1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('games reducer', () => {
  it('starts in the loading state', () => {
    expect(initialState.status).toBe('loading');
    expect(initialState.games).toEqual([]);
    expect(initialState.activeGame).toBeNull();
    expect(initialState.mutating).toBeNull();
    expect(initialState.toasts).toEqual([]);
  });

  it('LOAD_UNAUTH sets status to unauth', () => {
    const state = reducer(initialState, { type: 'LOAD_UNAUTH' });
    expect(state.status).toBe('unauth');
  });

  it('LOAD_SERVER_ERROR sets status to server_error', () => {
    const state = reducer(initialState, { type: 'LOAD_SERVER_ERROR' });
    expect(state.status).toBe('server_error');
  });

  it('LOAD_SUCCESS sets status to ready and stores the games', () => {
    const games = [game()];
    const state = reducer(initialState, { type: 'LOAD_SUCCESS', games });
    expect(state.status).toBe('ready');
    expect(state.games).toBe(games);
  });

  it('SELECT_GAME moves to detail_loading and clears activeGame', () => {
    const ready: PageState = { ...initialState, status: 'ready', games: [game()] };
    const state = reducer(ready, { type: 'SELECT_GAME', id: 'g1' });
    expect(state.status).toBe('detail_loading');
    expect(state.activeGame).toBeNull();
  });

  it('DETAIL_LOADED moves to detail and sets activeGame', () => {
    const g = game();
    const state = reducer(initialState, { type: 'DETAIL_LOADED', game: g });
    expect(state.status).toBe('detail');
    expect(state.activeGame).toBe(g);
  });

  it('DETAIL_ERROR falls back to ready with no activeGame', () => {
    const detail: PageState = { ...initialState, status: 'detail', activeGame: game() };
    const state = reducer(detail, { type: 'DETAIL_ERROR' });
    expect(state.status).toBe('ready');
    expect(state.activeGame).toBeNull();
  });

  it('MUTATE_START records which game id is mutating', () => {
    const state = reducer(initialState, { type: 'MUTATE_START', id: 'g1' });
    expect(state.mutating).toBe('g1');
  });

  it('MUTATE_SUCCESS updates both games and activeGame when ids match, and appends a success toast', () => {
    const original = game({ currentPlayers: 1 });
    const updated = game({ currentPlayers: 2 });
    const start: PageState = {
      ...initialState,
      games: [original],
      activeGame: original,
      mutating: 'g1',
    };
    const state = reducer(start, {
      type: 'MUTATE_SUCCESS',
      game: updated,
      message: 'Joined!',
    });

    expect(state.mutating).toBeNull();
    expect(state.games[0]).toBe(updated);
    expect(state.activeGame).toBe(updated);
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]).toEqual({ id: 1, message: 'Joined!', type: 'success' });
  });

  it('MUTATE_SUCCESS leaves activeGame untouched when ids do not match', () => {
    const activeGame = game({ id: 'other' });
    const start: PageState = {
      ...initialState,
      games: [game({ id: 'g1' })],
      activeGame,
      mutating: 'g1',
    };
    const state = reducer(start, {
      type: 'MUTATE_SUCCESS',
      game: game({ id: 'g1', currentPlayers: 5 }),
      message: 'Joined!',
    });
    expect(state.activeGame).toBe(activeGame);
  });

  it('MUTATE_ERROR clears mutating and appends an error toast', () => {
    const start: PageState = { ...initialState, mutating: 'g1' };
    const state = reducer(start, { type: 'MUTATE_ERROR', message: 'Nope' });
    expect(state.mutating).toBeNull();
    expect(state.toasts).toEqual([{ id: 1, message: 'Nope', type: 'error' }]);
  });

  it('_toastSeq increments monotonically across successive toasts', () => {
    let state = reducer(initialState, { type: 'MUTATE_ERROR', message: 'a' });
    state = reducer(state, { type: 'MUTATE_ERROR', message: 'b' });
    expect(state.toasts.map((t) => t.id)).toEqual([1, 2]);
    expect(state._toastSeq).toBe(2);
  });

  it('DISMISS_TOAST removes only the matching toast id', () => {
    let state = reducer(initialState, { type: 'MUTATE_ERROR', message: 'a' });
    state = reducer(state, { type: 'MUTATE_ERROR', message: 'b' });
    expect(state.toasts).toHaveLength(2);

    state = reducer(state, { type: 'DISMISS_TOAST', id: 1 });
    expect(state.toasts.map((t) => t.id)).toEqual([2]);
  });
});

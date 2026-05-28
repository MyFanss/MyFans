import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAN_QUICKSTART_STORAGE_KEY,
  FAN_QUICKSTART_UPDATED_EVENT,
  completeFanQuickstartSubscribe,
  isFanQuickstartComplete,
  loadFanQuickstartState,
  saveFanQuickstartState,
} from '@/lib/fan-quickstart';

describe('fan-quickstart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loadFanQuickstartState returns defaults when storage is empty', () => {
    expect(loadFanQuickstartState()).toEqual({
      wallet: false,
      explore: false,
      subscribe: false,
    });
  });

  it('loadFanQuickstartState normalizes stored booleans', () => {
    localStorage.setItem(
      FAN_QUICKSTART_STORAGE_KEY,
      JSON.stringify({ wallet: true, explore: 1, subscribe: 'x' }),
    );
    expect(loadFanQuickstartState()).toEqual({
      wallet: true,
      explore: true,
      subscribe: true,
    });
  });

  it('saveFanQuickstartState persists and dispatches event', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const state = { wallet: true, explore: false, subscribe: false };
    saveFanQuickstartState(state);
    expect(JSON.parse(localStorage.getItem(FAN_QUICKSTART_STORAGE_KEY)!)).toEqual(state);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: FAN_QUICKSTART_UPDATED_EVENT }),
    );
  });

  it('isFanQuickstartComplete requires all steps', () => {
    expect(
      isFanQuickstartComplete({
        wallet: true,
        explore: true,
        subscribe: false,
      }),
    ).toBe(false);
    expect(
      isFanQuickstartComplete({
        wallet: true,
        explore: true,
        subscribe: true,
      }),
    ).toBe(true);
  });

  it('completeFanQuickstartSubscribe sets subscribe true and keeps other flags', () => {
    localStorage.setItem(
      FAN_QUICKSTART_STORAGE_KEY,
      JSON.stringify({ wallet: true, explore: true, subscribe: false }),
    );
    completeFanQuickstartSubscribe();
    expect(loadFanQuickstartState()).toEqual({
      wallet: true,
      explore: true,
      subscribe: true,
    });
  });
});

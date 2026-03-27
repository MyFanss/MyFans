/**
 * Fan onboarding quickstart — persisted progress for wallet → browse → first sub.
 */

export const FAN_QUICKSTART_STORAGE_KEY = 'myfans_fan_quickstart_v1';

export type FanQuickstartStep = 'wallet' | 'explore' | 'subscribe';

export type FanQuickstartState = Record<FanQuickstartStep, boolean>;

const DEFAULT_STATE: FanQuickstartState = {
  wallet: false,
  explore: false,
  subscribe: false,
};

export function loadFanQuickstartState(): FanQuickstartState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(FAN_QUICKSTART_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<FanQuickstartState>;
    return {
      wallet: Boolean(parsed.wallet),
      explore: Boolean(parsed.explore),
      subscribe: Boolean(parsed.subscribe),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export const FAN_QUICKSTART_UPDATED_EVENT = 'fan-quickstart-updated';

export function saveFanQuickstartState(state: FanQuickstartState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FAN_QUICKSTART_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(FAN_QUICKSTART_UPDATED_EVENT));
}

export function isFanQuickstartComplete(state: FanQuickstartState): boolean {
  return state.wallet && state.explore && state.subscribe;
}

/** Call from Subscribe page after a successful subscription when `?fanQuickstart=1`. */
export function completeFanQuickstartSubscribe(): void {
  const prev = loadFanQuickstartState();
  saveFanQuickstartState({ ...prev, subscribe: true });
}

export const FeatureFlag = {
  BOOKMARKS: 'bookmarks',
  EARNINGS_WITHDRAWALS: 'earnings_withdrawals',
  EARNINGS_FEE_TRANSPARENCY: 'earnings_fee_transparency',
  REFERRAL_CODES: 'referral_codes',
} as const;

export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];
export type FeatureFlagSnapshot = Record<FeatureFlag, boolean>;

interface FeatureFlagDefinition {
  description: string;
  envKey: string;
}

type FeatureFlagOverrides = Partial<Record<FeatureFlag, boolean>>;

const FEATURE_FLAG_OVERRIDES_ENV_KEY = 'NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES';
const FEATURE_FLAGS_URL_ENV_KEY = 'NEXT_PUBLIC_FEATURE_FLAGS_URL';
const LOCAL_STORAGE_PREFIX = 'flags:';
export const FEATURE_FLAGS_UPDATED_EVENT = 'feature-flags:updated';
export const FEATURE_FLAGS_REFRESH_INTERVAL_MS = 60_000;

export const featureFlagDefinitions: Record<FeatureFlag, FeatureFlagDefinition> = {
  [FeatureFlag.BOOKMARKS]: {
    description: 'Shows creator bookmark controls across creator discovery and subscription flows.',
    envKey: 'NEXT_PUBLIC_FLAG_BOOKMARKS',
  },
  [FeatureFlag.EARNINGS_WITHDRAWALS]: {
    description: 'Enables the earnings withdrawal UI on the creator earnings page.',
    envKey: 'NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS',
  },
  [FeatureFlag.EARNINGS_FEE_TRANSPARENCY]: {
    description: 'Shows the fee transparency card on the creator earnings page.',
    envKey: 'NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY',
  },
  [FeatureFlag.REFERRAL_CODES]: {
    description: 'Enables referral / invite code input during checkout and share panel in settings.',
    envKey: 'NEXT_PUBLIC_FLAG_REFERRAL_CODES',
  },
};

export const defaultFeatureFlags: FeatureFlagSnapshot = Object.freeze({
  [FeatureFlag.BOOKMARKS]: false,
  [FeatureFlag.EARNINGS_WITHDRAWALS]: false,
  [FeatureFlag.EARNINGS_FEE_TRANSPARENCY]: false,
  [FeatureFlag.REFERRAL_CODES]: false,
});

let cachedRemoteFlags: FeatureFlagOverrides = {};
let remoteFlagsPromise: Promise<FeatureFlagOverrides> | null = null;

function logFeatureFlagWarning(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(message, error);
  }
}

function normalizeFlagValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }
  }

  return undefined;
}

function sanitizeFlagOverrides(value: unknown): FeatureFlagOverrides {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.values(FeatureFlag).reduce<FeatureFlagOverrides>((snapshot, flag) => {
    const normalizedValue = normalizeFlagValue((value as Record<string, unknown>)[flag]);

    if (normalizedValue !== undefined) {
      snapshot[flag] = normalizedValue;
    }

    return snapshot;
  }, {});
}

function getRemoteFlagsUrl(): string | undefined {
  return process.env[FEATURE_FLAGS_URL_ENV_KEY];
}

function isLocalOverrideAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env[FEATURE_FLAG_OVERRIDES_ENV_KEY] === 'true';
}

function getEnvOverride(flag: FeatureFlag): boolean | undefined {
  return normalizeFlagValue(process.env[featureFlagDefinitions[flag].envKey]);
}

function getLocalStorageOverride(flag: FeatureFlag): boolean | undefined {
  if (!isLocalOverrideAllowed() || typeof window === 'undefined') {
    return undefined;
  }

  return normalizeFlagValue(window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${flag}`));
}

function dispatchFeatureFlagsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FEATURE_FLAGS_UPDATED_EVENT));
  }
}

function resolveFeatureFlagValue(flag: FeatureFlag, remoteFlags: FeatureFlagOverrides): boolean {
  return (
    remoteFlags[flag] ??
    getEnvOverride(flag) ??
    getLocalStorageOverride(flag) ??
    defaultFeatureFlags[flag]
  );
}

export function getFeatureFlags(): FeatureFlagSnapshot {
  return Object.values(FeatureFlag).reduce<FeatureFlagSnapshot>((snapshot, flag) => {
    snapshot[flag] = resolveFeatureFlagValue(flag, cachedRemoteFlags);
    return snapshot;
  }, { ...defaultFeatureFlags });
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return getFeatureFlags()[flag] ?? false;
}

export async function fetchRemoteFlags(forceRefresh = false): Promise<FeatureFlagOverrides> {
  if (forceRefresh) {
    remoteFlagsPromise = null;
  }

  if (!remoteFlagsPromise) {
    remoteFlagsPromise = (async () => {
      const url = getRemoteFlagsUrl();

      if (!url) {
        return {};
      }

    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (!response.ok) {
        logFeatureFlagWarning(`Failed to fetch feature flags from ${url}.`);
        return {};
      }

      const payload = (await response.json()) as { flags?: unknown } | unknown;
      const rawFlags =
        payload && typeof payload === 'object' && 'flags' in payload
          ? (payload as { flags?: unknown }).flags
          : payload;

      return sanitizeFlagOverrides(rawFlags);
    } catch (error) {
      logFeatureFlagWarning('Feature flags are unavailable. Falling back to safe defaults.', error);
      return {};
    }
    })();
  }

  return remoteFlagsPromise;
}

export async function loadFeatureFlags(forceRefresh = false): Promise<FeatureFlagSnapshot> {
  cachedRemoteFlags = await fetchRemoteFlags(forceRefresh);
  return getFeatureFlags();
}

export async function refreshFeatureFlags(): Promise<FeatureFlagSnapshot> {
  return loadFeatureFlags(true);
}

export function setFeatureFlagOverride(flag: FeatureFlag, value: boolean) {
  if (!isLocalOverrideAllowed() || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${flag}`, String(value));
  dispatchFeatureFlagsUpdated();
}

export function clearFeatureFlagOverride(flag: FeatureFlag) {
  if (!isLocalOverrideAllowed() || typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${flag}`);
  dispatchFeatureFlagsUpdated();
}

export function resetFeatureFlagsForTests() {
  cachedRemoteFlags = {};
  remoteFlagsPromise = null;
}

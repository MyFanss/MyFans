/**
 * Analytics adapter: consent-gated event tracking with pluggable providers.
 *
 * Providers (NEXT_PUBLIC_ANALYTICS_PROVIDER):
 * - `noop` (default in production when unset): discard events
 * - `console` (default in development when unset): console.debug only
 * - `real`: send to configured endpoint / PostHog when keys are present
 *
 * Events are never sent unless `localStorage.telemetry_consent === 'true'`.
 *
 * @see docs/ANALYTICS.md
 */

export type AnalyticsProperties = Record<string, unknown>;

export interface AnalyticsProvider {
  readonly name: string;
  track(eventName: string, properties?: AnalyticsProperties): void;
  identify(userId: string, traits?: AnalyticsProperties): void;
}

const CONSENT_KEY = 'telemetry_consent';

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CONSENT_KEY) === 'true';
}

/** Discard all events (safe default for production without a provider). */
export const noopProvider: AnalyticsProvider = {
  name: 'noop',
  track() {},
  identify() {},
};

/** Log events to the console (local/dev inspection only). */
export const consoleProvider: AnalyticsProvider = {
  name: 'console',
  track(eventName, properties) {
    console.debug(`[Analytics] Track Event: ${eventName}`, properties ?? {});
  },
  identify(userId, traits) {
    console.debug(`[Analytics] Identify User: ${userId}`, traits ?? {});
  },
};

/**
 * Real provider: prefers PostHog when `window.posthog` is present,
 * otherwise POSTs to NEXT_PUBLIC_ANALYTICS_ENDPOINT when set.
 */
export const realProvider: AnalyticsProvider = {
  name: 'real',
  track(eventName, properties) {
    if (typeof window === 'undefined') return;

    const posthog = (window as Window & { posthog?: { capture?: (e: string, p?: AnalyticsProperties) => void } }).posthog;
    if (posthog?.capture) {
      posthog.capture(eventName, properties);
      return;
    }

    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
    if (endpoint) {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'track',
          event: eventName,
          properties: properties ?? {},
          ts: Date.now(),
        }),
        keepalive: true,
      }).catch(() => {
        /* swallow network errors — analytics must not break UX */
      });
      return;
    }

    // Misconfigured real provider: fall back to console in non-production
    if (process.env.NODE_ENV !== 'production') {
      consoleProvider.track(eventName, properties);
    }
  },
  identify(userId, traits) {
    if (typeof window === 'undefined') return;

    const posthog = (window as Window & { posthog?: { identify?: (id: string, t?: AnalyticsProperties) => void } }).posthog;
    if (posthog?.identify) {
      posthog.identify(userId, traits);
      return;
    }

    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
    if (endpoint) {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'identify',
          userId,
          traits: traits ?? {},
          ts: Date.now(),
        }),
        keepalive: true,
      }).catch(() => {});
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      consoleProvider.identify(userId, traits);
    }
  },
};

export type AnalyticsProviderName = 'noop' | 'console' | 'real';

export function resolveAnalyticsProviderName(
  envValue = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER,
  nodeEnv = process.env.NODE_ENV,
): AnalyticsProviderName {
  const raw = envValue?.trim().toLowerCase();
  if (raw === 'noop' || raw === 'console' || raw === 'real') return raw;
  // Dev default: console (no network). Prod default: noop (no tracking noise).
  return nodeEnv === 'production' ? 'noop' : 'console';
}

export function getAnalyticsProvider(
  name: AnalyticsProviderName = resolveAnalyticsProviderName(),
): AnalyticsProvider {
  switch (name) {
    case 'real':
      return realProvider;
    case 'console':
      return consoleProvider;
    case 'noop':
    default:
      return noopProvider;
  }
}

let activeProvider: AnalyticsProvider = getAnalyticsProvider();

/** Override the active provider (tests / runtime switches). */
export function setAnalyticsProvider(provider: AnalyticsProvider): void {
  activeProvider = provider;
}

/** Reset provider from env (useful after test overrides). */
export function resetAnalyticsProvider(): void {
  activeProvider = getAnalyticsProvider();
}

export function getActiveAnalyticsProvider(): AnalyticsProvider {
  return activeProvider;
}

/**
 * Consent-gated analytics facade.
 * Never tracks without explicit telemetry consent.
 */
export const analytics = {
  trackEvent: (eventName: string, properties?: AnalyticsProperties) => {
    if (!hasConsent()) {
      if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
        console.debug(`[Analytics] Blocked Event (Consent not granted): ${eventName}`);
      }
      return;
    }
    activeProvider.track(eventName, properties);
  },

  identifyUser: (userId: string, userTraits?: AnalyticsProperties) => {
    if (!hasConsent()) return;
    activeProvider.identify(userId, userTraits);
  },
};

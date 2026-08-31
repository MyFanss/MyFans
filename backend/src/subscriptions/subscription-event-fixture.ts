const fixture = require('./fixtures/subscription-event-fixture.json') as {
  targetEvents: readonly string[];
  aliases: Record<string, string>;
  eventSchemas: Record<string, { topics: string[]; data: string }>;
};

export const SUBSCRIPTION_EVENT_FIXTURE = fixture;

export const TARGET_EVENTS = fixture.targetEvents as readonly [
  'subscribed',
  'extended',
  'cancelled',
];

export type CanonicalSubscriptionEventType = typeof TARGET_EVENTS[number];

export function normalizeSubscriptionEventType(
  value?: string | null,
): CanonicalSubscriptionEventType | undefined {
  if (value == null) return undefined;

  const normalized = String(value).trim();
  if (!normalized) return undefined;

  const canonical = fixture.aliases[normalized] ?? normalized;
  return (fixture.targetEvents as readonly string[]).includes(canonical)
    ? (canonical as CanonicalSubscriptionEventType)
    : undefined;
}

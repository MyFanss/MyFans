import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';

/**
 * Analytics event names emitted by the platform.
 *
 * These are aligned with the polled subscription events so that the
 * server-side aggregates stay consistent with what the subscription
 * poller observes (see backend/docs/SLA_METRICS.md).
 */
export const ANALYTICS_EVENTS = {
  SUBSCRIBE: 'subscribe',
  CANCEL: 'cancel',
  UPLOAD: 'upload',
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * A single analytics event. `creatorId` is the tenant the event belongs to;
 * `occurredAt` is an ISO-8601 timestamp used for timezone-safe bucketing.
 * No raw PII (emails, names) is stored on the event.
 */
export interface AnalyticsEvent {
  name: AnalyticsEventName;
  creatorId: string;
  /** Subscriber identity, hashed/opaque — never a raw email. */
  subscriberRef?: string;
  /** Amount in minor units (cents) for subscribe/cancel events. */
  amountCents?: number;
  /** ISO-8601 timestamp of when the event occurred. */
  occurredAt: string;
}

/**
 * Durable/backed store for analytics events.
 *
 * `record()` writes through `append()` and aggregate reads go through
 * `list()`, so a Redis- or database-backed sink can be swapped in for
 * multi-instance deployments without changing any caller.
 */
export interface AnalyticsEventSink {
  append(event: AnalyticsEvent): void;
  list(): AnalyticsEvent[];
  /** Count of events for `creatorId` that the sink discarded; 0 means full history. */
  droppedCount(creatorId: string): number;
}

/**
 * Default in-memory sink. Retains at most `maxSize` events, evicting the
 * oldest first so a long-running process cannot grow without bound.
 *
 * Not a source of billing numbers: once anything is evicted, aggregates
 * computed from `list()` are incomplete and are flagged `truncated`.
 */
export class InMemoryAnalyticsEventSink implements AnalyticsEventSink {
  private readonly events: AnalyticsEvent[] = [];
  private readonly dropped = new Map<string, number>();

  constructor(private readonly maxSize: number = InMemoryAnalyticsEventSink.resolveMaxSize()) {}

  private static resolveMaxSize(): number {
    const parsed = Number.parseInt(process.env.ANALYTICS_EVENT_SINK_MAX_SIZE ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
  }

  append(event: AnalyticsEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      const evicted = this.events.splice(0, this.events.length - this.maxSize);
      for (const e of evicted) {
        this.dropped.set(e.creatorId, (this.dropped.get(e.creatorId) ?? 0) + 1);
      }
    }
  }

  list(): AnalyticsEvent[] {
    return [...this.events];
  }

  droppedCount(creatorId: string): number {
    return this.dropped.get(creatorId) ?? 0;
  }
}

/**
 * Aggregated MRR snapshot for a creator dashboard.
 * All monetary values are in minor units (cents).
 */
export interface MrrSnapshot {
  creatorId: string;
  /** Monthly recurring revenue in cents, computed live from events. */
  mrrCents: number;
  /** Number of currently active subscriptions. */
  activeSubscriptions: number;
  /** Subscriptions started within the current period. */
  newSubscriptions: number;
  /** Subscriptions cancelled within the current period. */
  cancelledSubscriptions: number;
  /** Uploads recorded within the current period. */
  uploads: number;
  /** Inclusive start of the aggregation window (ISO-8601). */
  periodStart: string;
  /** Exclusive end of the aggregation window (ISO-8601). */
  periodEnd: string;
  /** True when the sink evicted events for this creator, so totals may be under-reported. */
  truncated: boolean;
}

/**
 * Live summary payload for the creator dashboard home.
 *
 * Derived entirely from the live event stream — never from mocks. `isEmpty`
 * lets the dashboard render an explicit empty state (e.g. zero subscribers)
 * without inferring it from individual counters.
 */
export interface DashboardSummary extends MrrSnapshot {
  /** True when the creator has no subscribers and no activity in the window. */
  isEmpty: boolean;
}

/**
 * AnalyticsModule service.
 *
 * Responsibilities:
 *  - Emit subscribe / cancel / upload events (event emission layer).
 *  - Compute live MRR server-side for the creator dashboard (no mocked data).
 *  - Enforce creator-only authorization on aggregate reads.
 *
 * Events flow through an injected `AnalyticsEventSink`; the default in-memory
 * sink is bounded, and a durable sink can be wired behind `record()` without
 * changing callers. Aggregates are derived from the same event stream the
 * subscription poller feeds, so the dashboard and the poller never disagree.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly eventSink: AnalyticsEventSink) {}

  /**
   * Emit an analytics event. Called by subscription and upload flows.
   * Idempotency is the caller's responsibility (e.g. one event per
   * subscription transition), matching the polled subscription events.
   */
  record(event: AnalyticsEvent): void {
    if (!event.creatorId) {
      throw new ForbiddenException('creatorId is required for analytics events');
    }
    if (event.occurredAt !== undefined && Number.isNaN(Date.parse(event.occurredAt))) {
      throw new BadRequestException(
        'occurredAt must be a valid ISO-8601 timestamp',
      );
    }
    this.eventSink.append({
      ...event,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    });
    this.logger.debug(
      `analytics event ${event.name} for creator ${event.creatorId}`,
    );
  }

  /** Convenience emitters aligned with polled subscription events. */
  recordSubscribe(creatorId: string, subscriberRef: string, amountCents: number): void {
    this.record({
      name: ANALYTICS_EVENTS.SUBSCRIBE,
      creatorId,
      subscriberRef,
      amountCents,
      occurredAt: new Date().toISOString(),
    });
  }

  recordCancel(creatorId: string, subscriberRef: string, amountCents: number): void {
    this.record({
      name: ANALYTICS_EVENTS.CANCEL,
      creatorId,
      subscriberRef,
      amountCents,
      occurredAt: new Date().toISOString(),
    });
  }

  recordUpload(creatorId: string): void {
    this.record({
      name: ANALYTICS_EVENTS.UPLOAD,
      creatorId,
      occurredAt: new Date().toISOString(),
    });
  }

  /**
   * Compute a live MRR snapshot for a creator.
   *
   * `requesterId` must equal `creatorId` — aggregates are creator-only.
   * The window is [periodStart, periodEnd); callers pass explicit UTC bounds
   * so timezone boundaries are handled by the caller, not guessed here.
   *
   * Active subscriptions and MRR are derived from each subscriber's latest
   * event at or before `periodEnd`: a subscriber is active when that latest
   * event is a subscribe, and contributes its current plan amount. Events
   * after `periodEnd` are ignored, and an unmatched cancel for an unknown
   * subscriber never affects another subscriber's revenue.
   */
  getMrrSnapshot(
    creatorId: string,
    requesterId: string,
    periodStart: Date,
    periodEnd: Date,
  ): MrrSnapshot {
    if (requesterId !== creatorId) {
      throw new ForbiddenException('MRR aggregates are creator-only');
    }

    const startMs = periodStart.getTime();
    const endMs = periodEnd.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new BadRequestException('periodStart and periodEnd must be valid dates');
    }
    if (startMs >= endMs) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    let newSubscriptions = 0;
    let cancelledSubscriptions = 0;
    let uploads = 0;

    // Latest subscription event per subscriber, considering only events at or
    // before `periodEnd`. Keyed by subscriberRef; events without a ref cannot
    // be attributed to a subscriber and are ignored for active/MRR totals.
    const latestBySubscriber = new Map<string, AnalyticsEvent>();

    for (const event of this.eventSink.list()) {
      if (event.creatorId !== creatorId) continue;
      const at = Date.parse(event.occurredAt);
      if (Number.isNaN(at) || at >= endMs) continue;
      const inWindow = at >= startMs;

      switch (event.name) {
        case ANALYTICS_EVENTS.SUBSCRIBE:
          if (inWindow) newSubscriptions += 1;
          if (event.subscriberRef) {
            const prev = latestBySubscriber.get(event.subscriberRef);
            if (!prev || Date.parse(prev.occurredAt) <= at) {
              latestBySubscriber.set(event.subscriberRef, event);
            }
          }
          break;
        case ANALYTICS_EVENTS.CANCEL:
          if (inWindow) cancelledSubscriptions += 1;
          if (event.subscriberRef) {
            const prev = latestBySubscriber.get(event.subscriberRef);
            if (!prev || Date.parse(prev.occurredAt) <= at) {
              latestBySubscriber.set(event.subscriberRef, event);
            }
          }
          break;
        case ANALYTICS_EVENTS.UPLOAD:
          if (inWindow) uploads += 1;
          break;
      }
    }

    let mrrCents = 0;
    let activeSubscriptions = 0;
    for (const latest of latestBySubscriber.values()) {
      if (latest.name !== ANALYTICS_EVENTS.SUBSCRIBE) continue;
      activeSubscriptions += 1;
      mrrCents += latest.amountCents ?? 0;
    }

    return {
      creatorId,
      mrrCents,
      activeSubscriptions,
      newSubscriptions,
      cancelledSubscriptions,
      uploads,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      truncated: this.eventSink.droppedCount(creatorId) > 0,
    };
  }

  /**
   * Live summary for the creator dashboard home.
   *
   * Wraps `getMrrSnapshot` with an explicit empty-state flag so the dashboard
   * can render "no subscribers yet" without guessing. Creator-only, same as
   * the underlying aggregate. No mocked data is ever returned here.
   */
  getDashboardSummary(
    creatorId: string,
    requesterId: string,
    periodStart: Date,
    periodEnd: Date,
  ): DashboardSummary {
    const snapshot = this.getMrrSnapshot(creatorId, requesterId, periodStart, periodEnd);
    return {
      ...snapshot,
      isEmpty:
        snapshot.activeSubscriptions === 0 &&
        snapshot.newSubscriptions === 0 &&
        snapshot.cancelledSubscriptions === 0 &&
        snapshot.uploads === 0,
    };
  }
}

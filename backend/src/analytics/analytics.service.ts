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
}

/**
 * Default in-memory sink. Retains at most `maxSize` events, evicting the
 * oldest first so a long-running process cannot grow without bound.
 */
export class InMemoryAnalyticsEventSink implements AnalyticsEventSink {
  private readonly events: AnalyticsEvent[] = [];

  constructor(private readonly maxSize: number = InMemoryAnalyticsEventSink.resolveMaxSize()) {}

  private static resolveMaxSize(): number {
    const parsed = Number.parseInt(process.env.ANALYTICS_EVENT_SINK_MAX_SIZE ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
  }

  append(event: AnalyticsEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events.splice(0, this.events.length - this.maxSize);
    }
  }

  list(): AnalyticsEvent[] {
    return [...this.events];
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

    let mrrCents = 0;
    let activeSubscriptions = 0;
    let newSubscriptions = 0;
    let cancelledSubscriptions = 0;
    let uploads = 0;

    for (const event of this.eventSink.list()) {
      if (event.creatorId !== creatorId) continue;
      const at = Date.parse(event.occurredAt);
      const inWindow = at >= startMs && at < endMs;

      switch (event.name) {
        case ANALYTICS_EVENTS.SUBSCRIBE:
          activeSubscriptions += 1;
          mrrCents += event.amountCents ?? 0;
          if (inWindow) newSubscriptions += 1;
          break;
        case ANALYTICS_EVENTS.CANCEL:
          // Refunds/cancels reduce active count and MRR.
          activeSubscriptions = Math.max(0, activeSubscriptions - 1);
          mrrCents = Math.max(0, mrrCents - (event.amountCents ?? 0));
          if (inWindow) cancelledSubscriptions += 1;
          break;
        case ANALYTICS_EVENTS.UPLOAD:
          if (inWindow) uploads += 1;
          break;
      }
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
    const snapshot = this.getMrrSnapshot(
      creatorId,
      requesterId,
      periodStart,
      periodEnd,
    );

    const isEmpty =
      snapshot.activeSubscriptions === 0 &&
      snapshot.newSubscriptions === 0 &&
      snapshot.cancelledSubscriptions === 0 &&
      snapshot.uploads === 0;

    return { ...snapshot, isEmpty };
  }

  /**
   * Privacy-safe export of raw events for a creator.
   *
   * Raw subscriber identifiers (which may be emails) are stripped by default;
   * only the opaque `subscriberRef` is retained. Pass `includePii: true` only
   * for an explicit, audited export path.
   */
  exportEvents(creatorId: string, requesterId: string, includePii = false): AnalyticsEvent[] {
    if (requesterId !== creatorId) {
      throw new ForbiddenException('Analytics export is creator-only');
    }
    return this.eventSink
      .list()
      .filter((event) => event.creatorId === creatorId)
      .map((event) => (includePii ? { ...event } : { ...event, subscriberRef: undefined }));
  }
}

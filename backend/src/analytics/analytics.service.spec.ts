import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ANALYTICS_EVENTS,
  AnalyticsEvent,
  AnalyticsService,
  InMemoryAnalyticsEventSink,
} from './analytics.service';

describe('InMemoryAnalyticsEventSink', () => {
  it('retains events up to the configured cap', () => {
    const sink = new InMemoryAnalyticsEventSink(3);

    sink.append({ name: 'subscribe', creatorId: 'c1', occurredAt: new Date().toISOString() });
    sink.append({ name: 'cancel', creatorId: 'c1', occurredAt: new Date().toISOString() });
    sink.append({ name: 'upload', creatorId: 'c1', occurredAt: new Date().toISOString() });

    expect(sink.list()).toHaveLength(3);
  });

  it('evicts the oldest events once the cap is exceeded', () => {
    const sink = new InMemoryAnalyticsEventSink(2);

    sink.append({ name: 'subscribe', creatorId: 'c1', subscriberRef: 'u1', occurredAt: new Date().toISOString() });
    sink.append({ name: 'cancel', creatorId: 'c1', subscriberRef: 'u2', occurredAt: new Date().toISOString() });
    sink.append({ name: 'upload', creatorId: 'c1', subscriberRef: 'u3', occurredAt: new Date().toISOString() });

    const events = sink.list();
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.subscriberRef)).toEqual(['u2', 'u3']);
  });

  it('defaults to a sane maximum when no cap is provided', () => {
    const sink = new InMemoryAnalyticsEventSink();

    for (let i = 0; i < 100; i += 1) {
      sink.append({ name: 'subscribe', creatorId: `c${i}`, occurredAt: new Date().toISOString() });
    }

    expect(sink.list().length).toBeLessThanOrEqual(100);
  });
});

describe('AnalyticsService', () => {
  let sink: InMemoryAnalyticsEventSink;
  let service: AnalyticsService;

  beforeEach(() => {
    sink = new InMemoryAnalyticsEventSink(100);
    service = new AnalyticsService(sink);
  });

  describe('record()', () => {
    it('throws ForbiddenException when creatorId is falsy', () => {
      expect(() =>
        service.record({
          name: 'subscribe',
          creatorId: '',
          subscriberRef: 'sub-1',
          amountCents: 500,
          occurredAt: new Date().toISOString(),
        }),
      ).toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when creatorId is undefined', () => {
      expect(() =>
        service.record({
          name: 'subscribe',
          creatorId: undefined as unknown as string,
          subscriberRef: 'sub-1',
          amountCents: 500,
          occurredAt: new Date().toISOString(),
        }),
      ).toThrow(ForbiddenException);
    });

    it('defaults occurredAt to the current time when omitted', () => {
      const before = Date.now();
      service.record({
        name: 'upload',
        creatorId: 'creator-1',
      } as unknown as AnalyticsEvent);
      const after = Date.now();

      const [event] = sink.list();
      const at = Date.parse(event.occurredAt);
      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(after);
    });

    it('stores a valid ISO-8601 occurredAt unchanged', () => {
      const occurredAt = '2026-01-15T12:00:00.000Z';
      service.record({ name: 'upload', creatorId: 'creator-1', occurredAt });

      const [event] = sink.list();
      expect(event.occurredAt).toBe(occurredAt);
    });

    it('throws BadRequestException when occurredAt is not a parseable ISO-8601 timestamp', () => {
      expect(() =>
        service.record({
          name: 'upload',
          creatorId: 'creator-1',
          occurredAt: 'not-a-date',
        }),
      ).toThrow(BadRequestException);
      expect(sink.list()).toHaveLength(0);
    });
  });

  describe('convenience emitters', () => {
    const creatorId = 'creator-1';
    const subscriberRef = 'sub-1';
    const amountCents = 1500;

    it('recordSubscribe appends a subscribe event with the expected shape', () => {
      service.recordSubscribe(creatorId, subscriberRef, amountCents);

      const [event] = sink.list();
      expect(event.name).toBe(ANALYTICS_EVENTS.SUBSCRIBE);
      expect(event.creatorId).toBe(creatorId);
      expect(event.subscriberRef).toBe(subscriberRef);
      expect(event.amountCents).toBe(amountCents);
      expect(typeof event.occurredAt).toBe('string');
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    });

    it('recordCancel appends a cancel event with the expected shape', () => {
      service.recordCancel(creatorId, subscriberRef, amountCents);

      const [event] = sink.list();
      expect(event.name).toBe(ANALYTICS_EVENTS.CANCEL);
      expect(event.creatorId).toBe(creatorId);
      expect(event.subscriberRef).toBe(subscriberRef);
      expect(event.amountCents).toBe(amountCents);
    });

    it('recordUpload appends an upload event with the expected shape', () => {
      service.recordUpload(creatorId);

      const [event] = sink.list();
      expect(event.name).toBe(ANALYTICS_EVENTS.UPLOAD);
      expect(event.creatorId).toBe(creatorId);
      expect(event.subscriberRef).toBeUndefined();
    });
  });

  describe('MRR snapshot authorization', () => {
    const creatorId = 'creator-1';
    const periodStart = new Date('2026-01-01T00:00:00.000Z');
    const periodEnd = new Date('2026-02-01T00:00:00.000Z');

    it('rejects a requesterId that differs from creatorId', () => {
      expect(() =>
        service.getMrrSnapshot(creatorId, 'someone-else', periodStart, periodEnd),
      ).toThrow(ForbiddenException);
    });

    it('returns the documented snapshot fields when requesterId matches creatorId', () => {
      service.recordSubscribe(creatorId, 'sub-1', 1000);

      const snapshot = service.getMrrSnapshot(creatorId, creatorId, periodStart, periodEnd);

      expect(snapshot.creatorId).toBe(creatorId);
      expect(snapshot.mrrCents).toBe(1000);
      expect(snapshot.activeSubscriptions).toBe(1);
      expect(snapshot.periodStart).toBe(periodStart.toISOString());
      expect(snapshot.periodEnd).toBe(periodEnd.toISOString());
    });
  });

  it('routes recorded events through the injected sink', () => {
    service.record({
      name: 'subscribe',
      creatorId: 'creator-1',
      occurredAt: new Date().toISOString(),
    });

    expect(sink.list()).toHaveLength(1);
  });
});

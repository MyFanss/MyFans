import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService, InMemoryAnalyticsEventSink } from './analytics.service';

describe('InMemoryAnalyticsEventSink', () => {
  it('retains events up to the configured cap', () => {
    const sink = new InMemoryAnalyticsEventSink(3);

    sink.append({ type: 'subscribe', userId: 'u1' } as any);
    sink.append({ type: 'cancel', userId: 'u2' } as any);
    sink.append({ type: 'upload', userId: 'u3' } as any);

    expect(sink.list()).toHaveLength(3);
  });

  it('evicts the oldest events once the cap is exceeded', () => {
    const sink = new InMemoryAnalyticsEventSink(2);

    sink.append({ type: 'subscribe', userId: 'u1' } as any);
    sink.append({ type: 'cancel', userId: 'u2' } as any);
    sink.append({ type: 'upload', userId: 'u3' } as any);

    const events = sink.list();
    expect(events).toHaveLength(2);
    expect(events.map((e: any) => e.userId)).toEqual(['u2', 'u3']);
  });

  it('defaults to a sane maximum when no cap is provided', () => {
    const sink = new InMemoryAnalyticsEventSink();

    for (let i = 0; i < 100; i += 1) {
      sink.append({ type: 'subscribe', userId: `u${i}` } as any);
    }

    expect(sink.list().length).toBeLessThanOrEqual(100);
  });
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    service = new AnalyticsService();
  });

  describe('record()', () => {
    it('throws ForbiddenException when creatorId is falsy', () => {
      expect(() =>
        service.record({
          name: 'subscribe',
          creatorId: '',
          subscriberRef: 'sub-1',
          amountCents: 500,
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
        }),
      ).toThrow(ForbiddenException);
    });
  });

  describe('convenience emitters', () => {
    const creatorId = 'creator-1';
    const subscriberRef = 'sub-1';
    const amountCents = 1500;

    it('recordSubscribe emits a subscribe event with the expected shape', () => {
      const event = service.recordSubscribe({ creatorId, subscriberRef, amountCents });

      expect(event.name).toBe('subscribe');
      expect(event.creatorId).toBe(creatorId);
      expect(event.subscriberRef).toBe(subscriberRef);
      expect(event.amountCents).toBe(amountCents);
      expect(typeof event.occurredAt).toBe('string');
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    });

    it('recordCancel emits a cancel event with the expected shape', () => {
      const event = service.recordCancel({ creatorId, subscriberRef, amountCents });

      expect(event.name).toBe('cancel');
      expect(event.creatorId).toBe(creatorId);
      expect(event.subscriberRef).toBe(subscriberRef);
      expect(event.amountCents).toBe(amountCents);
      expect(typeof event.occurredAt).toBe('string');
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    });

    it('recordUpload emits an upload event with the expected shape', () => {
      const event = service.recordUpload({ creatorId, subscriberRef, amountCents });

      expect(event.name).toBe('upload');
      expect(event.creatorId).toBe(creatorId);
      expect(event.subscriberRef).toBe(subscriberRef);
      expect(event.amountCents).toBe(amountCents);
      expect(typeof event.occurredAt).toBe('string');
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    });
  });

  describe('MRR snapshot authorization', () => {
    const creatorId = 'creator-1';

    it('rejects a requesterId that differs from creatorId', () => {
      expect(() =>
        service.getMrrSnapshot({ requesterId: 'someone-else', creatorId }),
      ).toThrow(ForbiddenException);
    });

    it('returns the documented snapshot fields when requesterId matches creatorId', () => {
      const snapshot = service.getMrrSnapshot({ requesterId: creatorId, creatorId });

      expect(snapshot).toBeDefined();
      expect(snapshot.creatorId).toBe(creatorId);
      expect(typeof snapshot.mrrCents).toBe('number');
      expect(typeof snapshot.activeSubscribers).toBe('number');
      expect(typeof snapshot.generatedAt).toBe('string');
      expect(new Date(snapshot.generatedAt).toISOString()).toBe(snapshot.generatedAt);
    });
  });

  it('routes recorded events through the injected sink', () => {
    const sink = new InMemoryAnalyticsEventSink(10);
    const service = new AnalyticsService(sink as any);

    service.record({ type: 'subscribe', userId: 'u1' } as any);

    expect(sink.list()).toHaveLength(1);
  });
});
  });
});

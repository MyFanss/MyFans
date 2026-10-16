import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

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
});

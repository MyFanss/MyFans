import { UnlockEventConsumerStub, UnlockEvent } from './unlock-event-consumer.stub';

describe('UnlockEventConsumerStub', () => {
  const baseEvent: UnlockEvent = {
    fanId: 'fan-1',
    creatorId: 'creator-1',
    contentId: 'content-1',
    unlockedAt: 1_000,
  };

  it('upserts an access row for a new unlock event', () => {
    const consumer = new UnlockEventConsumerStub();

    const row = consumer.handle(baseEvent);

    expect(row).toEqual(baseEvent);
    expect(consumer.hasAccess('fan-1', 'creator-1', 'content-1')).toBe(true);
  });

  it('is idempotent when the same unlock event is replayed', () => {
    const consumer = new UnlockEventConsumerStub();

    consumer.handle(baseEvent);
    const rowAfterReplay = consumer.handle(baseEvent);

    expect(rowAfterReplay).toEqual(baseEvent);
  });

  it('does not create duplicate rows for the same fan/creator/content key', () => {
    const consumer = new UnlockEventConsumerStub();

    consumer.handle(baseEvent);
    consumer.handle({ ...baseEvent, unlockedAt: 2_000 });

    expect(consumer.hasAccess('fan-1', 'creator-1', 'content-1')).toBe(true);
  });

  it('does not grant access for an unrelated fan/creator/content combination', () => {
    const consumer = new UnlockEventConsumerStub();

    consumer.handle(baseEvent);

    expect(consumer.hasAccess('fan-2', 'creator-1', 'content-1')).toBe(false);
  });
});

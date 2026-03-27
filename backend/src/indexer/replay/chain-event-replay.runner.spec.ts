import {
  ChainEventRecord,
  ChainEventReplayRunner,
  ChainEventSource,
  ChainEventStore,
} from './chain-event-replay.runner';

class InMemorySource implements ChainEventSource {
  constructor(private readonly pages: ChainEventRecord[][]) {}
  private pageIndex = 0;

  async fetchPage(cursor: string, _limit: number) {
    const events = this.pages[this.pageIndex] ?? [];
    this.pageIndex += 1;
    const nextCursor =
      events.length > 0 ? String(events[events.length - 1].paging_token) : cursor;
    return { events, nextCursor };
  }
}

class InMemoryStore implements ChainEventStore {
  private readonly seen = new Set<string>();

  async init() {}

  async persistBatch(events: ChainEventRecord[], dryRun: boolean) {
    let inserted = 0;
    for (const event of events) {
      if (!this.seen.has(event.paging_token)) {
        if (!dryRun) {
          this.seen.add(event.paging_token);
        }
        inserted += 1;
      }
    }
    return { inserted, duplicates: events.length - inserted };
  }

  async close() {}
}

function event(cursor: string): ChainEventRecord {
  return {
    id: `event-${cursor}`,
    paging_token: cursor,
    type: 'payment',
  };
}

describe('ChainEventReplayRunner', () => {
  it('replays until source is exhausted', async () => {
    const source = new InMemorySource([[event('10'), event('11')], [event('12')], []]);
    const store = new InMemoryStore();
    const runner = new ChainEventReplayRunner(source, store);

    const summary = await runner.replay({
      startCursor: '9',
      limit: 200,
      dryRun: false,
    });

    expect(summary.fetched).toBe(3);
    expect(summary.inserted).toBe(3);
    expect(summary.duplicates).toBe(0);
    expect(summary.finalCursor).toBe('12');
  });

  it('stops at end cursor and only processes <= end cursor', async () => {
    const source = new InMemorySource([[event('10'), event('11')], [event('12')], []]);
    const store = new InMemoryStore();
    const runner = new ChainEventReplayRunner(source, store);

    const summary = await runner.replay({
      startCursor: '9',
      endCursor: '11',
      limit: 200,
      dryRun: false,
    });

    expect(summary.fetched).toBe(2);
    expect(summary.inserted).toBe(2);
    expect(summary.finalCursor).toBe('11');
  });

  it('reports dry-run inserts without mutating state', async () => {
    const source = new InMemorySource([[event('10'), event('11')], []]);
    const store = new InMemoryStore();
    const runner = new ChainEventReplayRunner(source, store);

    const dryRunSummary = await runner.replay({
      startCursor: '9',
      limit: 200,
      dryRun: true,
    });
    const replaySummary = await runner.replay({
      startCursor: '9',
      limit: 200,
      dryRun: false,
    });

    expect(dryRunSummary.inserted).toBe(2);
    expect(replaySummary.inserted).toBe(2);
  });
});

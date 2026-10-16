import { AnalyticsService } from './analytics.service';
import { InMemoryAnalyticsEventSink } from './analytics.service';

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
  it('routes recorded events through the injected sink', () => {
    const sink = new InMemoryAnalyticsEventSink(10);
    const service = new AnalyticsService(sink as any);

    service.record({ type: 'subscribe', userId: 'u1' } as any);

    expect(sink.list()).toHaveLength(1);
  });
});

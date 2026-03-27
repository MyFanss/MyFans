import { ChainEventRecord, ChainEventSource, FetchPageResult } from './chain-event-replay.runner';

interface HorizonOperationResponse {
  _embedded?: {
    records?: ChainEventRecord[];
  };
}

export class HorizonChainEventSource implements ChainEventSource {
  constructor(private readonly horizonBaseUrl: string) {}

  async fetchPage(cursor: string, limit: number): Promise<FetchPageResult> {
    const url = new URL('/operations', this.horizonBaseUrl);
    url.searchParams.set('order', 'asc');
    url.searchParams.set('cursor', cursor);
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Horizon request failed (${response.status} ${response.statusText})`);
    }

    const payload = (await response.json()) as HorizonOperationResponse;
    const events = payload._embedded?.records ?? [];
    const nextCursor =
      events.length > 0 ? String(events[events.length - 1].paging_token) : cursor;

    return { events, nextCursor };
  }
}

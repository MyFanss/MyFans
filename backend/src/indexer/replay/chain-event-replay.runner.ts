export interface ChainEventRecord {
  id: string;
  paging_token: string;
  type: string;
  transaction_hash?: string;
  source_account?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface FetchPageResult {
  events: ChainEventRecord[];
  nextCursor: string;
}

export interface ChainEventSource {
  fetchPage(cursor: string, limit: number): Promise<FetchPageResult>;
}

export interface PersistResult {
  inserted: number;
  duplicates: number;
}

export interface ChainEventStore {
  init(): Promise<void>;
  persistBatch(events: ChainEventRecord[], dryRun: boolean): Promise<PersistResult>;
  close(): Promise<void>;
}

export interface ReplayOptions {
  startCursor: string;
  endCursor?: string;
  limit: number;
  dryRun: boolean;
}

export interface ReplaySummary {
  startCursor: string;
  endCursor?: string;
  finalCursor: string;
  pages: number;
  fetched: number;
  inserted: number;
  duplicates: number;
  dryRun: boolean;
}

function compareCursor(a: string, b: string): number {
  try {
    const left = BigInt(a);
    const right = BigInt(b);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  } catch {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
}

export class ChainEventReplayRunner {
  constructor(
    private readonly source: ChainEventSource,
    private readonly store: ChainEventStore,
  ) {}

  async replay(options: ReplayOptions): Promise<ReplaySummary> {
    await this.store.init();

    let cursor = options.startCursor;
    let pages = 0;
    let fetched = 0;
    let inserted = 0;
    let duplicates = 0;
    let done = false;

    while (!done) {
      const page = await this.source.fetchPage(cursor, options.limit);
      pages += 1;

      if (page.events.length === 0) {
        done = true;
        break;
      }

      const selectedEvents =
        options.endCursor === undefined
          ? page.events
          : page.events.filter(
              (event) => compareCursor(event.paging_token, options.endCursor as string) <= 0,
            );

      fetched += selectedEvents.length;

      if (selectedEvents.length > 0) {
        const result = await this.store.persistBatch(selectedEvents, options.dryRun);
        inserted += result.inserted;
        duplicates += result.duplicates;
      }

      const pageLastCursor = page.nextCursor;
      cursor = pageLastCursor;

      if (
        options.endCursor !== undefined &&
        compareCursor(pageLastCursor, options.endCursor) >= 0
      ) {
        done = true;
      } else if (page.events.length < options.limit) {
        done = true;
      }
    }

    await this.store.close();

    return {
      startCursor: options.startCursor,
      endCursor: options.endCursor,
      finalCursor: cursor,
      pages,
      fetched,
      inserted,
      duplicates,
      dryRun: options.dryRun,
    };
  }
}

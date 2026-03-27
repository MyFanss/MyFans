import { Pool } from 'pg';
import {
  ChainEventRecord,
  ChainEventStore,
  PersistResult,
} from './chain-event-replay.runner';

export class PostgresChainEventStore implements ChainEventStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chain_event_replay (
        paging_token TEXT PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        tx_hash TEXT,
        source_account TEXT,
        ledger_closed_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        replayed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async persistBatch(
    events: ChainEventRecord[],
    dryRun: boolean,
  ): Promise<PersistResult> {
    if (events.length === 0) {
      return { inserted: 0, duplicates: 0 };
    }

    if (dryRun) {
      const duplicates = await this.countExisting(events.map((event) => event.paging_token));
      return { inserted: events.length - duplicates, duplicates };
    }

    let inserted = 0;
    for (const event of events) {
      const result = await this.pool.query(
        `
          INSERT INTO chain_event_replay (
            paging_token,
            event_id,
            event_type,
            tx_hash,
            source_account,
            ledger_closed_at,
            payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT (paging_token) DO NOTHING
        `,
        [
          String(event.paging_token),
          String(event.id),
          String(event.type),
          event.transaction_hash ? String(event.transaction_hash) : null,
          event.source_account ? String(event.source_account) : null,
          event.created_at ? new Date(String(event.created_at)) : null,
          JSON.stringify(event),
        ],
      );

      inserted += result.rowCount ?? 0;
    }

    return { inserted, duplicates: events.length - inserted };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async countExisting(pagingTokens: string[]): Promise<number> {
    const uniqueTokens = Array.from(new Set(pagingTokens));
    const result = await this.pool.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM chain_event_replay
        WHERE paging_token = ANY($1::text[])
      `,
      [uniqueTokens],
    );
    const total = result.rows[0]?.total ?? '0';
    return Number.parseInt(total, 10);
  }
}

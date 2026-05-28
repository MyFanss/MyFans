import { Injectable, Logger } from '@nestjs/common';

export interface LedgerClockSnapshot {
  ledgerSeq: number;
  ledgerCloseTimeUnix: number; // seconds
  capturedAtMs: number;        // Date.now() when snapshot was taken
  skewMs: number;              // ledgerCloseTimeUnix*1000 - capturedAtMs (negative = ledger behind wall clock)
}

/**
 * Fetches the latest ledger close time from Horizon and computes the skew
 * between ledger time and the server wall clock.
 *
 * Stellar produces ~1 ledger every 5 seconds, but the exact cadence drifts.
 * This service converts a ledger sequence number to an estimated Unix timestamp
 * using the most recently observed close time as an anchor.
 */
@Injectable()
export class LedgerClockService {
  private readonly logger = new Logger(LedgerClockService.name);
  private readonly LEDGER_CLOSE_SECONDS = 5; // nominal Stellar close time

  private horizonUrl(): string {
    return (
      process.env.HORIZON_URL?.trim() ||
      'https://horizon-testnet.stellar.org'
    );
  }

  /**
   * Fetches the latest ledger from Horizon and returns a clock snapshot.
   * Throws if the network request fails.
   */
  async fetchSnapshot(): Promise<LedgerClockSnapshot> {
    const url = `${this.horizonUrl()}/ledgers?order=desc&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Horizon ledger fetch failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as {
      _embedded: { records: Array<{ sequence: number; closed_at: string }> };
    };
    const record = json._embedded.records[0];
    if (!record) throw new Error('No ledger records returned from Horizon');

    const ledgerSeq = record.sequence;
    const ledgerCloseTimeUnix = Math.floor(
      new Date(record.closed_at).getTime() / 1000,
    );
    const capturedAtMs = Date.now();
    const skewMs = ledgerCloseTimeUnix * 1000 - capturedAtMs;

    this.logger.debug(
      `Ledger #${ledgerSeq} closed at ${record.closed_at}; skew=${skewMs}ms`,
    );

    return { ledgerSeq, ledgerCloseTimeUnix, capturedAtMs, skewMs };
  }

  /**
   * Converts a ledger sequence number to an estimated Unix timestamp (seconds).
   *
   * Uses the snapshot as an anchor:
   *   estimatedUnix = snapshot.ledgerCloseTimeUnix
   *                 + (targetSeq - snapshot.ledgerSeq) * LEDGER_CLOSE_SECONDS
   */
  ledgerSeqToUnix(targetSeq: number, snapshot: LedgerClockSnapshot): number {
    const deltaLedgers = targetSeq - snapshot.ledgerSeq;
    return snapshot.ledgerCloseTimeUnix + deltaLedgers * this.LEDGER_CLOSE_SECONDS;
  }

  /**
   * Returns the skew-corrected current time in Unix seconds.
   * i.e. what the ledger "thinks" the current time is.
   */
  ledgerNowUnix(snapshot: LedgerClockSnapshot): number {
    const wallNowMs = Date.now();
    return Math.floor((wallNowMs + snapshot.skewMs) / 1000);
  }
}

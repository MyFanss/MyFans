'use client';

import { useEffect, useState } from 'react';

export interface ClockSkew {
  /** Difference in ms: ledgerCloseTimeMs - Date.now() at time of fetch.
   *  Negative means the ledger close time is behind the browser wall clock. */
  skewMs: number;
  ledgerSeq: number;
  ledgerCloseTimeUnix: number; // seconds
  fetchedAtMs: number;
}

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

const LEDGER_CLOSE_SECONDS = 5;

async function fetchLedgerClockSkew(): Promise<ClockSkew> {
  const res = await fetch(`${HORIZON_URL}/ledgers?order=desc&limit=1`);
  if (!res.ok) throw new Error(`Horizon ${res.status}`);
  const json = (await res.json()) as {
    _embedded: { records: Array<{ sequence: number; closed_at: string }> };
  };
  const record = json._embedded.records[0];
  if (!record) throw new Error('No ledger records');
  const ledgerCloseTimeUnix = Math.floor(new Date(record.closed_at).getTime() / 1000);
  const fetchedAtMs = Date.now();
  return {
    skewMs: ledgerCloseTimeUnix * 1000 - fetchedAtMs,
    ledgerSeq: record.sequence,
    ledgerCloseTimeUnix,
    fetchedAtMs,
  };
}

/**
 * Converts a ledger sequence number to an estimated Unix timestamp (seconds)
 * using the skew snapshot as an anchor.
 */
export function ledgerSeqToUnix(targetSeq: number, skew: ClockSkew): number {
  const deltaLedgers = targetSeq - skew.ledgerSeq;
  return skew.ledgerCloseTimeUnix + deltaLedgers * LEDGER_CLOSE_SECONDS;
}

/**
 * Returns the skew-corrected "ledger now" in Unix seconds.
 * i.e. what the ledger considers the current time.
 */
export function ledgerNowUnix(skew: ClockSkew): number {
  return Math.floor((Date.now() + skew.skewMs) / 1000);
}

/**
 * Fetches the Stellar ledger close time once and exposes the clock skew.
 * Re-fetches every `refreshIntervalMs` (default 60 s).
 */
export function useClockSkew(refreshIntervalMs = 60_000): {
  skew: ClockSkew | null;
  error: string | null;
  loading: boolean;
} {
  const [skew, setSkew] = useState<ClockSkew | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchLedgerClockSkew();
        if (!cancelled) {
          setSkew(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshIntervalMs]);

  return { skew, error, loading };
}

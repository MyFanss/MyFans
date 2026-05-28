import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClockSkew, ledgerSeqToUnix, ledgerNowUnix, type ClockSkew } from '../useClockSkew';

const LEDGER_CLOSE_SECONDS = 5;

function makeSkew(overrides: Partial<ClockSkew> = {}): ClockSkew {
  const ledgerCloseTimeUnix = 1_700_000_000;
  const fetchedAtMs = ledgerCloseTimeUnix * 1000 + 500; // wall 500ms ahead
  return {
    skewMs: ledgerCloseTimeUnix * 1000 - fetchedAtMs, // -500
    ledgerSeq: 100_000,
    ledgerCloseTimeUnix,
    fetchedAtMs,
    ...overrides,
  };
}

function mockHorizonFetch(ledgerSeq: number, closedAtUnix: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            { sequence: ledgerSeq, closed_at: new Date(closedAtUnix * 1000).toISOString() },
          ],
        },
      }),
    }),
  );
}

describe('ledgerSeqToUnix', () => {
  it('returns anchor time when target equals snapshot seq', () => {
    const skew = makeSkew();
    expect(ledgerSeqToUnix(skew.ledgerSeq, skew)).toBe(skew.ledgerCloseTimeUnix);
  });

  it('adds 5 seconds per ledger ahead', () => {
    const skew = makeSkew();
    expect(ledgerSeqToUnix(skew.ledgerSeq + 12, skew)).toBe(
      skew.ledgerCloseTimeUnix + 12 * LEDGER_CLOSE_SECONDS,
    );
  });

  it('subtracts 5 seconds per ledger behind', () => {
    const skew = makeSkew();
    expect(ledgerSeqToUnix(skew.ledgerSeq - 4, skew)).toBe(
      skew.ledgerCloseTimeUnix - 4 * LEDGER_CLOSE_SECONDS,
    );
  });
});

describe('ledgerNowUnix', () => {
  it('returns skew-corrected current time', () => {
    const skew = makeSkew(); // skewMs = -500
    vi.spyOn(Date, 'now').mockReturnValue(skew.fetchedAtMs + 1000);
    const expected = Math.floor((skew.fetchedAtMs + 1000 + skew.skewMs) / 1000);
    expect(ledgerNowUnix(skew)).toBe(expected);
    vi.restoreAllMocks();
  });

  it('equals wall clock when skew is zero', () => {
    const ledgerCloseTimeUnix = 1_700_000_000;
    const skew = makeSkew({ ledgerCloseTimeUnix, fetchedAtMs: ledgerCloseTimeUnix * 1000, skewMs: 0 });
    vi.spyOn(Date, 'now').mockReturnValue(ledgerCloseTimeUnix * 1000);
    expect(ledgerNowUnix(skew)).toBe(ledgerCloseTimeUnix);
    vi.restoreAllMocks();
  });
});

describe('useClockSkew', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns skew after successful fetch', async () => {
    const ledgerCloseTimeUnix = 1_700_000_000;
    mockHorizonFetch(50_000, ledgerCloseTimeUnix);
    vi.spyOn(Date, 'now').mockReturnValue(ledgerCloseTimeUnix * 1000 + 200);

    const { result } = renderHook(() => useClockSkew());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.skew).not.toBeNull();
    expect(result.current.skew!.ledgerSeq).toBe(50_000);
    expect(result.current.skew!.skewMs).toBe(-200);
  });

  it('sets error when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' }),
    );

    const { result } = renderHook(() => useClockSkew());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.skew).toBeNull();
    expect(result.current.error).toMatch(/503/);
  });

  it('starts in loading state', () => {
    mockHorizonFetch(50_000, 1_700_000_000);
    const { result } = renderHook(() => useClockSkew());
    expect(result.current.loading).toBe(true);
  });
});

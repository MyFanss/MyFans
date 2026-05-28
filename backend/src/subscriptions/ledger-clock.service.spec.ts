import { LedgerClockService, LedgerClockSnapshot } from './ledger-clock.service';

const LEDGER_CLOSE_SECONDS = 5;

function makeSnapshot(overrides: Partial<LedgerClockSnapshot> = {}): LedgerClockSnapshot {
  const ledgerCloseTimeUnix = 1_700_000_000;
  const capturedAtMs = ledgerCloseTimeUnix * 1000 + 200; // wall clock 200 ms ahead of ledger
  return {
    ledgerSeq: 50_000,
    ledgerCloseTimeUnix,
    capturedAtMs,
    skewMs: ledgerCloseTimeUnix * 1000 - capturedAtMs, // -200
    ...overrides,
  };
}

describe('LedgerClockService', () => {
  let service: LedgerClockService;

  beforeEach(() => {
    service = new LedgerClockService();
  });

  describe('ledgerSeqToUnix', () => {
    it('returns anchor time when targetSeq equals snapshot ledgerSeq', () => {
      const snap = makeSnapshot();
      expect(service.ledgerSeqToUnix(snap.ledgerSeq, snap)).toBe(snap.ledgerCloseTimeUnix);
    });

    it('adds LEDGER_CLOSE_SECONDS per ledger ahead of anchor', () => {
      const snap = makeSnapshot();
      const target = snap.ledgerSeq + 10;
      expect(service.ledgerSeqToUnix(target, snap)).toBe(
        snap.ledgerCloseTimeUnix + 10 * LEDGER_CLOSE_SECONDS,
      );
    });

    it('subtracts LEDGER_CLOSE_SECONDS per ledger behind anchor', () => {
      const snap = makeSnapshot();
      const target = snap.ledgerSeq - 6;
      expect(service.ledgerSeqToUnix(target, snap)).toBe(
        snap.ledgerCloseTimeUnix - 6 * LEDGER_CLOSE_SECONDS,
      );
    });

    it('handles large future sequence numbers without overflow', () => {
      const snap = makeSnapshot();
      const farFuture = snap.ledgerSeq + 6_307_200; // ~1 year of ledgers
      const result = service.ledgerSeqToUnix(farFuture, snap);
      expect(result).toBeGreaterThan(snap.ledgerCloseTimeUnix);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe('ledgerNowUnix', () => {
    it('returns wall clock minus skew in seconds', () => {
      const snap = makeSnapshot(); // skewMs = -200
      const wallNowMs = snap.capturedAtMs + 1000; // 1 second later
      jest.spyOn(Date, 'now').mockReturnValue(wallNowMs);

      const result = service.ledgerNowUnix(snap);
      // (wallNowMs + skewMs) / 1000 = (capturedAtMs + 1000 - 200) / 1000
      const expected = Math.floor((wallNowMs + snap.skewMs) / 1000);
      expect(result).toBe(expected);

      jest.restoreAllMocks();
    });

    it('ledgerNowUnix is less than wall clock when ledger is behind', () => {
      const snap = makeSnapshot(); // skewMs = -200 (ledger behind wall)
      jest.spyOn(Date, 'now').mockReturnValue(snap.capturedAtMs);

      const ledgerNow = service.ledgerNowUnix(snap);
      const wallNow = Math.floor(snap.capturedAtMs / 1000);
      expect(ledgerNow).toBeLessThanOrEqual(wallNow);

      jest.restoreAllMocks();
    });

    it('ledgerNowUnix equals wall clock when skew is zero', () => {
      const ledgerCloseTimeUnix = 1_700_000_000;
      const capturedAtMs = ledgerCloseTimeUnix * 1000; // exact match
      const snap = makeSnapshot({ ledgerCloseTimeUnix, capturedAtMs, skewMs: 0 });
      jest.spyOn(Date, 'now').mockReturnValue(capturedAtMs);

      expect(service.ledgerNowUnix(snap)).toBe(ledgerCloseTimeUnix);

      jest.restoreAllMocks();
    });
  });

  describe('fetchSnapshot skew calculation', () => {
    it('computes negative skewMs when wall clock is ahead of ledger', async () => {
      const ledgerCloseTimeUnix = 1_700_000_000;
      const capturedAtMs = ledgerCloseTimeUnix * 1000 + 3000; // wall 3s ahead

      jest.spyOn(Date, 'now').mockReturnValue(capturedAtMs);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          _embedded: {
            records: [
              {
                sequence: 100_000,
                closed_at: new Date(ledgerCloseTimeUnix * 1000).toISOString(),
              },
            ],
          },
        }),
      }) as jest.Mock;

      const snap = await service.fetchSnapshot();
      expect(snap.skewMs).toBe(-3000);
      expect(snap.ledgerSeq).toBe(100_000);
      expect(snap.ledgerCloseTimeUnix).toBe(ledgerCloseTimeUnix);

      jest.restoreAllMocks();
    });

    it('throws when Horizon returns non-ok status', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      }) as jest.Mock;

      await expect(service.fetchSnapshot()).rejects.toThrow('503');

      jest.restoreAllMocks();
    });
  });
});

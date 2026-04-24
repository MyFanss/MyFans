/**
 * Unit tests for SubscriptionChainReaderService simulation typing.
 *
 * Covers every branch of the SDK discriminated union:
 *   SimulateTransactionErrorResponse   → isSimulationError
 *   SimulateTransactionSuccessResponse → isSimulationSuccess
 *   SimulateTransactionRestoreResponse → isSimulationRestore
 *
 * Also verifies graceful handling of: network errors, missing retval,
 * and the restore (archived entry) path.
 */
import { rpc, xdr, nativeToScVal } from '@stellar/stellar-sdk';
import { SubscriptionChainReaderService } from './subscription-chain-reader.service';
import { LedgerClockService } from './ledger-clock.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const FAN     = 'GFAN1111111111111111111111111111111111111111111111111111';
const CREATOR = 'GCREATOR111111111111111111111111111111111111111111111111';

function makeService(simResult: rpc.Api.SimulateTransactionResponse): SubscriptionChainReaderService {
  const ledgerClock = {
    fetchSnapshot: jest.fn().mockResolvedValue({
      ledgerSeq: 1000,
      ledgerCloseTimeUnix: 1_700_000_000,
      capturedAtMs: 1_700_000_000_000,
      skewMs: -200,
    }),
    ledgerSeqToUnix: jest.fn().mockReturnValue(1_700_000_000 + 30 * 24 * 3600),
  } as unknown as LedgerClockService;

  const svc = new SubscriptionChainReaderService(ledgerClock);

  // Stub the private makeServer() so no real network call is made
  jest.spyOn(svc as any, 'makeServer').mockReturnValue({
    simulateTransaction: jest.fn().mockResolvedValue(simResult),
  });

  return svc;
}

/** Build a minimal success response */
function successSim(retval: xdr.ScVal): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    _parsed: true,
    id: '1',
    latestLedger: 1000,
    events: [],
    transactionData: {} as any,
    minResourceFee: '100',
    result: { auth: [], retval },
  } as rpc.Api.SimulateTransactionSuccessResponse;
}

/** Build a minimal error response */
function errorSim(error: string): rpc.Api.SimulateTransactionErrorResponse {
  return {
    _parsed: true,
    id: '1',
    latestLedger: 1000,
    events: [],
    error,
  } as rpc.Api.SimulateTransactionErrorResponse;
}

/** Build a minimal restore response */
function restoreSim(): rpc.Api.SimulateTransactionRestoreResponse {
  return {
    _parsed: true,
    id: '1',
    latestLedger: 1000,
    events: [],
    transactionData: {} as any,
    minResourceFee: '100',
    result: { auth: [], retval: nativeToScVal(true) },
    restorePreamble: { minResourceFee: '200', transactionData: {} as any },
  } as rpc.Api.SimulateTransactionRestoreResponse;
}

// ── readIsSubscriber ──────────────────────────────────────────────────────────

describe('SubscriptionChainReaderService.readIsSubscriber', () => {
  it('returns ok=true isSubscriber=true on success sim with true retval', async () => {
    const svc = makeService(successSim(nativeToScVal(true)));
    const result = await svc.readIsSubscriber(CONTRACT_ID, FAN, CREATOR);
    expect(result).toEqual({ ok: true, isSubscriber: true });
  });

  it('returns ok=true isSubscriber=false on success sim with false retval', async () => {
    const svc = makeService(successSim(nativeToScVal(false)));
    const result = await svc.readIsSubscriber(CONTRACT_ID, FAN, CREATOR);
    expect(result).toEqual({ ok: true, isSubscriber: false });
  });

  it('returns ok=false with error string on error sim', async () => {
    const svc = makeService(errorSim('contract not found'));
    const result = await svc.readIsSubscriber(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/contract not found/i);
  });

  it('returns ok=false with restore message on restore sim', async () => {
    const svc = makeService(restoreSim());
    const result = await svc.readIsSubscriber(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/restoration/i);
  });

  it('returns ok=false when simulateTransaction rejects (network error)', async () => {
    const svc = new SubscriptionChainReaderService({
      fetchSnapshot: jest.fn(),
      ledgerSeqToUnix: jest.fn(),
    } as unknown as LedgerClockService);
    jest.spyOn(svc as any, 'makeServer').mockReturnValue({
      simulateTransaction: jest.fn().mockRejectedValue(new Error('connection refused')),
    });
    const result = await svc.readIsSubscriber(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/connection refused/i);
  });

  it('returns ok=false when success sim has no retval', async () => {
    const sim: rpc.Api.SimulateTransactionSuccessResponse = {
      _parsed: true,
      id: '1',
      latestLedger: 1000,
      events: [],
      transactionData: {} as any,
      minResourceFee: '100',
      // result intentionally absent
    } as rpc.Api.SimulateTransactionSuccessResponse;
    const svc = makeService(sim);
    const result = await svc.readIsSubscriber(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/no retval/i);
  });
});

// ── readExpiryUnix ────────────────────────────────────────────────────────────

describe('SubscriptionChainReaderService.readExpiryUnix', () => {
  it('returns ok=true with expiryUnix from contract when non-zero', async () => {
    const contractExpiry = 1_800_000_000n;
    const retval = nativeToScVal([1200n, contractExpiry] as any);
    const svc = makeService(successSim(retval));
    const result = await svc.readExpiryUnix(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expiryUnix).toBe(Number(contractExpiry));
      expect(typeof result.skewMs).toBe('number');
    }
  });

  it('returns ok=false on error sim', async () => {
    const svc = makeService(errorSim('host function error'));
    const result = await svc.readExpiryUnix(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false on restore sim', async () => {
    const svc = makeService(restoreSim());
    const result = await svc.readExpiryUnix(CONTRACT_ID, FAN, CREATOR);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/restoration/i);
  });
});

// ── readPlan ──────────────────────────────────────────────────────────────────

describe('SubscriptionChainReaderService.readPlan', () => {
  it('returns ok=true with plan fields on success sim', async () => {
    const planNative = { creator: CREATOR, asset: 'XLM', amount: 10_000_000n, interval_days: 30 };
    const retval = nativeToScVal(planNative as any);
    const svc = makeService(successSim(retval));
    const result = await svc.readPlan(CONTRACT_ID, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.creator).toBe(CREATOR);
      expect(result.plan.amount).toBe('10000000');
      expect(result.plan.intervalDays).toBe(30);
    }
  });

  it('returns ok=false on error sim', async () => {
    const svc = makeService(errorSim('plan not found'));
    const result = await svc.readPlan(CONTRACT_ID, 99);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false on restore sim', async () => {
    const svc = makeService(restoreSim());
    const result = await svc.readPlan(CONTRACT_ID, 1);
    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/restoration/i);
  });
});

// ── readPlanCount ─────────────────────────────────────────────────────────────

describe('SubscriptionChainReaderService.readPlanCount', () => {
  it('returns ok=true with count on success sim', async () => {
    const svc = makeService(successSim(nativeToScVal(5, { type: 'u32' })));
    const result = await svc.readPlanCount(CONTRACT_ID);
    expect(result).toEqual({ ok: true, count: 5 });
  });

  it('returns ok=false on error sim', async () => {
    const svc = makeService(errorSim('contract error'));
    const result = await svc.readPlanCount(CONTRACT_ID);
    expect(result.ok).toBe(false);
  });

  it('returns ok=false on restore sim', async () => {
    const svc = makeService(restoreSim());
    const result = await svc.readPlanCount(CONTRACT_ID);
    expect(result.ok).toBe(false);
  });
});

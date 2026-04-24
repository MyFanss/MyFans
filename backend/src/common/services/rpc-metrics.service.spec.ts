import { RpcMetricsService } from './rpc-metrics.service';

describe('RpcMetricsService', () => {
  let svc: RpcMetricsService;

  beforeEach(() => {
    svc = new RpcMetricsService();
  });

  it('records a successful RPC call and reflects it in the snapshot', () => {
    svc.record('getHealth', true, 42);
    const snap = svc.snapshot();
    expect(snap.totalCalls).toBe(1);
    expect(snap.endpoints).toHaveLength(1);
    const ep = snap.endpoints[0];
    expect(ep.method).toBe('getHealth');
    expect(ep.calls).toBe(1);
    expect(ep.successes).toBe(1);
    expect(ep.failures).toBe(0);
    expect(ep.avgLatencyMs).toBe(42);
    expect(ep.errorRate).toBe(0);
  });

  it('records a failed RPC call and reflects it in the snapshot', () => {
    svc.record('getLedgerEntries', false, 5000);
    const snap = svc.snapshot();
    expect(snap.totalCalls).toBe(1);
    const ep = snap.endpoints[0];
    expect(ep.successes).toBe(0);
    expect(ep.failures).toBe(1);
    expect(ep.errorRate).toBe(1);
  });

  it('computes correct error rate for mixed results', () => {
    svc.record('loadAccount', true, 100);
    svc.record('loadAccount', true, 150);
    svc.record('loadAccount', false, 2000);
    const ep = svc.snapshot().endpoints[0];
    expect(ep.calls).toBe(3);
    expect(ep.successes).toBe(2);
    expect(ep.failures).toBe(1);
    expect(ep.errorRate).toBeCloseTo(1 / 3);
    expect(ep.avgLatencyMs).toBe(Math.round((100 + 150 + 2000) / 3));
  });

  it('groups different RPC methods separately', () => {
    svc.record('getHealth', true, 10);
    svc.record('getLedgerEntries', true, 20);
    svc.record('loadAccount', false, 500);
    expect(svc.snapshot().endpoints).toHaveLength(3);
  });

  it('reset clears all data', () => {
    svc.record('getHealth', true, 10);
    svc.reset();
    expect(svc.snapshot().totalCalls).toBe(0);
    expect(svc.snapshot().endpoints).toHaveLength(0);
  });

  it('handles empty snapshot gracefully', () => {
    const snap = svc.snapshot();
    expect(snap.totalCalls).toBe(0);
    expect(snap.endpoints).toHaveLength(0);
    expect(snap.collectedAt).toBeDefined();
  });
});

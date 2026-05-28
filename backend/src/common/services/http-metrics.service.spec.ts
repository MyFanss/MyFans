import { HttpMetricsService } from './http-metrics.service';

describe('HttpMetricsService', () => {
  let svc: HttpMetricsService;

  beforeEach(() => {
    svc = new HttpMetricsService();
  });

  it('records a request and reflects it in the snapshot', () => {
    svc.record('GET', '/v1/users', 200, 42);
    const snap = svc.snapshot();
    expect(snap.totalRequests).toBe(1);
    expect(snap.endpoints).toHaveLength(1);
    const ep = snap.endpoints[0];
    expect(ep.method).toBe('GET');
    expect(ep.route).toBe('/v1/users');
    expect(ep.requests).toBe(1);
    expect(ep.avgLatencyMs).toBe(42);
    expect(ep.errors5xx).toBe(0);
    expect(ep.errors4xx).toBe(0);
  });

  it('counts 4xx and 5xx errors separately', () => {
    svc.record('POST', '/v1/auth/login', 400, 10);
    svc.record('POST', '/v1/auth/login', 500, 20);
    svc.record('POST', '/v1/auth/login', 200, 15);
    const ep = svc.snapshot().endpoints[0];
    expect(ep.errors4xx).toBe(1);
    expect(ep.errors5xx).toBe(1);
    expect(ep.errorRate).toBeCloseTo(2 / 3);
  });

  it('computes correct percentiles', () => {
    // Record 100 requests with latencies 1..100
    for (let i = 1; i <= 100; i++) {
      svc.record('GET', '/v1/posts', 200, i);
    }
    const ep = svc.snapshot().endpoints[0];
    expect(ep.p50Ms).toBe(50);
    expect(ep.p95Ms).toBe(95);
    expect(ep.p99Ms).toBe(99);
  });

  it('tracks min and max latency', () => {
    svc.record('GET', '/v1/health', 200, 5);
    svc.record('GET', '/v1/health', 200, 300);
    svc.record('GET', '/v1/health', 200, 50);
    const ep = svc.snapshot().endpoints[0];
    expect(ep.minLatencyMs).toBe(5);
    expect(ep.maxLatencyMs).toBe(300);
  });

  it('groups different routes separately', () => {
    svc.record('GET', '/v1/users', 200, 10);
    svc.record('POST', '/v1/users', 201, 20);
    svc.record('GET', '/v1/posts', 200, 30);
    expect(svc.snapshot().endpoints).toHaveLength(3);
  });

  it('reset clears all data', () => {
    svc.record('GET', '/v1/users', 200, 10);
    svc.reset();
    expect(svc.snapshot().totalRequests).toBe(0);
    expect(svc.snapshot().endpoints).toHaveLength(0);
  });
});

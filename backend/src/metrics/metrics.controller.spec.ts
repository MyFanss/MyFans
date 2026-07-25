import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MetricsController, MetricsAlert } from './metrics.controller';
import { MetricsGuard } from './metrics.guard';
import { HttpMetricsService } from '../common/services/http-metrics.service';
import { RpcMetricsService } from '../common/services/rpc-metrics.service';
import { ModerationSlaService } from '../moderation/moderation-sla.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  const mockHttpMetrics = {
    snapshot: jest.fn(),
  } as unknown as HttpMetricsService;
  const mockRpcMetrics = {
    snapshot: jest.fn(),
  } as unknown as RpcMetricsService;
  const mockModerationSla = {
    snapshot: jest.fn(),
  } as unknown as ModerationSlaService;

  beforeEach(() => {
    controller = new MetricsController(
      mockHttpMetrics,
      mockRpcMetrics,
      mockModerationSla,
    );

    mockHttpMetrics.snapshot.mockReset();
    mockRpcMetrics.snapshot.mockReset();
    mockModerationSla.snapshot.mockReset();
  });

  it('returns metrics snapshot with alerts for HTTP and RPC thresholds', async () => {
    mockHttpMetrics.snapshot.mockReturnValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      totalRequests: 2,
      endpoints: [
        {
          route: '/v1/auth/login',
          method: 'POST',
          requests: 10,
          errors5xx: 1,
          errors4xx: 0,
          totalLatencyMs: 6500,
          histogram: { 5: 0, 10: 0, 25: 0, 50: 0, 100: 0, 250: 0, 500: 0, 1000: 0, 2500: 10, 5000: 0, Infinity: 0 },
          minLatencyMs: 400,
          maxLatencyMs: 900,
          avgLatencyMs: 650,
          p50Ms: 650,
          p95Ms: 900,
          p99Ms: 900,
          errorRate: 0.1,
          lastSeenAt: '2026-05-31T00:00:00.000Z',
        },
      ],
    });

    mockRpcMetrics.snapshot.mockReturnValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      totalCalls: 2,
      endpoints: [
        {
          method: 'getHealth',
          calls: 10,
          successes: 9,
          failures: 1,
          totalLatencyMs: 16000,
          avgLatencyMs: 1600,
          errorRate: 0.1,
          lastCallAt: '2026-05-31T00:00:00.000Z',
        },
      ],
    });

    mockModerationSla.snapshot.mockResolvedValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      openCount: 0,
      byStatus: [],
    });

    const snapshot = await controller.getMetrics();

    expect(snapshot.rpc.totalCalls).toBe(2);
    expect(snapshot.alerts).toEqual(
      expect.arrayContaining<MetricsAlert>([
        expect.objectContaining({ source: 'http', metric: 'errorRate' }),
        expect.objectContaining({ source: 'http', metric: 'p95Ms' }),
        expect.objectContaining({ source: 'rpc', metric: 'errorRate' }),
        expect.objectContaining({ source: 'rpc', metric: 'avgLatencyMs' }),
      ]),
    );
  });

  it('renders Prometheus metrics text for HTTP and RPC snapshots', async () => {
    mockHttpMetrics.snapshot.mockReturnValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      totalRequests: 1,
      endpoints: [
        {
          route: '/v1/auth/login',
          method: 'POST',
          requests: 2,
          errors5xx: 1,
          errors4xx: 0,
          totalLatencyMs: 250,
          histogram: { 5: 0, 10: 0, 25: 0, 50: 0, 100: 0, 250: 2, 500: 0, 1000: 0, 2500: 0, 5000: 0, Infinity: 0 },
          minLatencyMs: 120,
          maxLatencyMs: 130,
          avgLatencyMs: 125,
          p50Ms: 125,
          p95Ms: 130,
          p99Ms: 130,
          errorRate: 0.5,
          lastSeenAt: '2026-05-31T00:00:00.000Z',
        },
      ],
    });

    mockRpcMetrics.snapshot.mockReturnValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      totalCalls: 1,
      endpoints: [
        {
          method: 'getHealth',
          calls: 1,
          successes: 1,
          failures: 0,
          totalLatencyMs: 100,
          avgLatencyMs: 100,
          errorRate: 0,
          lastCallAt: '2026-05-31T00:00:00.000Z',
        },
      ],
    });

    const output = await controller.getPrometheusMetrics();

    expect(output).toContain('backend_http_requests_total{method="POST",route="/v1/auth/login"} 2');
    expect(output).toContain('backend_http_request_errors_total{method="POST",route="/v1/auth/login",code="5xx"} 1');
    expect(output).toContain('backend_soroban_rpc_calls_total{method="getHealth",outcome="success"} 1');
    expect(output).toContain('backend_soroban_rpc_duration_seconds_total{method="getHealth"} 0.1');
  });
});

describe('MetricsController with Guard Protection', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeEach(async () => {
    const mockHttpMetrics = {
      snapshot: jest.fn(),
    } as unknown as HttpMetricsService;

    const mockRpcMetrics = {
      snapshot: jest.fn(),
    } as unknown as RpcMetricsService;

    const mockModerationSla = {
      snapshot: jest.fn().mockResolvedValue({
        collectedAt: '2026-05-31T00:00:00.000Z',
        openCount: 0,
        byStatus: [],
      }),
    } as unknown as ModerationSlaService;

    mockHttpMetrics.snapshot.mockReturnValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      totalRequests: 1,
      endpoints: [],
    });

    mockRpcMetrics.snapshot.mockReturnValue({
      collectedAt: '2026-05-31T00:00:00.000Z',
      totalCalls: 1,
      endpoints: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [MetricsController],
      providers: [
        {
          provide: HttpMetricsService,
          useValue: mockHttpMetrics,
        },
        {
          provide: RpcMetricsService,
          useValue: mockRpcMetrics,
        },
        {
          provide: ModerationSlaService,
          useValue: mockModerationSla,
        },
        MetricsGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    configService = module.get<ConfigService>(ConfigService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 for /v1/metrics without Authorization header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 for /v1/metrics with invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 for /v1/metrics with valid scrape token', async () => {
    jest.spyOn(configService, 'get').mockReturnValue('valid-token');

    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.text);
    expect(body).toHaveProperty('collectedAt');
  });

  it('returns 401 for /v1/metrics/prometheus without Authorization header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics/prometheus',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 for /v1/metrics/prometheus with valid scrape token', async () => {
    jest.spyOn(configService, 'get').mockReturnValue('valid-token');

    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics/prometheus',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(
      'text/plain; version=0.0.4',
    );
  });
});

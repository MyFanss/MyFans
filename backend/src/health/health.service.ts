import { Injectable } from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';
import { DataSource } from 'typeorm';
import { SorobanRpcService, SorobanHealthStatus } from '../common/services/soroban-rpc.service';
import { QueueMetricsService, QueueSnapshot } from '../common/services/queue-metrics.service';

export interface HealthCheckResult {
    status: 'up' | 'down' | 'degraded';
    timestamp: string;
}

/**
 * Result of the Redis PING probe.
 *
 * Redis is an optional cache/session store. When no connection is configured
 * the probe reports `not_configured` rather than `down`, so an absent Redis
 * does not drag the aggregate health to `degraded`.
 */
export interface RedisHealthStatus {
    status: 'up' | 'down' | 'not_configured';
    latencyMs?: number;
    error?: string;
}

export interface DetailedHealthCheckResult extends HealthCheckResult {
    checks?: {
        database?: { status: 'up' | 'down' | 'degraded'; error?: string };
        sorobanRpc?: SorobanHealthStatus;
        sorobanContract?: SorobanHealthStatus;
    };
}

export interface AggregatedHealthResult {
  status: 'up' | 'down' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  subsystems: {
    database: { status: 'up' | 'down' | 'degraded'; latencyMs?: number; error?: string };
    // Omitted entirely when Redis is not configured (optional subsystem).
    redis?: RedisHealthStatus;
    sorobanRpc: SorobanHealthStatus;
    sorobanContract: SorobanHealthStatus;
  };
  summary: {
    total: number;
    up: number;
    degraded: number;
    down: number;
  };
}

const START_TIME = Date.now();

@Injectable()
export class HealthService {
  /** Upper bound for connecting to Redis and awaiting the PING reply. */
  private static readonly REDIS_PING_TIMEOUT_MS = 2000;

  constructor(
    private dataSource: DataSource,
    private sorobanRpcService: SorobanRpcService,
    private queueMetrics: QueueMetricsService,
  ) {}

  getHealth(): DetailedHealthCheckResult {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  async getDetailedHealth(): Promise<DetailedHealthCheckResult> {
    const [dbHealth, rpcHealth, contractHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkSorobanRpc(),
      this.checkSorobanContract(),
    ]);

    // Determine overall status
    let overallStatus: 'up' | 'down' | 'degraded' = 'up';

    if (dbHealth.status === 'down') {
      overallStatus = 'down';
    } else if (rpcHealth.status === 'down' || contractHealth.status === 'down') {
      overallStatus = 'down';
    } else if (
      rpcHealth.status === 'degraded' ||
      contractHealth.status === 'degraded' ||
      dbHealth.status === 'degraded'
    ) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
        sorobanRpc: rpcHealth,
        sorobanContract: contractHealth,
      },
    };
  }

  /**
   * Aggregated health check — runs all subsystem checks in parallel and
   * returns a structured summary with per-subsystem latency and a numeric
   * summary (total / up / degraded / down).
   *
   * HTTP status mapping (used by the controller):
   *   overall 'up'       → 200
   *   overall 'degraded' → 200  (service is functional but impaired)
   *   overall 'down'     → 503
   */
  async getAggregatedHealth(): Promise<AggregatedHealthResult> {
    const [dbHealth, redisHealth, rpcHealth, contractHealth] = await Promise.all([
      this.checkDatabaseWithLatency(),
      this.checkRedis(),
      this.checkSorobanRpc(),
      this.checkSorobanContract(),
    ]);

    // An unconfigured Redis is skipped so it neither counts toward the summary
    // nor degrades the aggregate status.
    const redisConfigured = redisHealth.status !== 'not_configured';

    const subsystems = [
      dbHealth.status,
      ...(redisConfigured ? [redisHealth.status] : []),
      rpcHealth.status,
      contractHealth.status,
    ];

    const summary = {
      total: subsystems.length,
      up: subsystems.filter((s) => s === 'up').length,
      degraded: subsystems.filter((s) => s === 'degraded').length,
      down: subsystems.filter((s) => s === 'down').length,
    };

    let overallStatus: 'up' | 'down' | 'degraded' = 'up';
    if (summary.down > 0) {
      // Database down is always fatal; other subsystems degrade the service
      overallStatus = dbHealth.status === 'down' ? 'down' : 'degraded';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      version: process.env.npm_package_version ?? 'unknown',
      subsystems: {
        database: dbHealth,
        ...(redisConfigured ? { redis: redisHealth } : {}),
        sorobanRpc: rpcHealth,
        sorobanContract: contractHealth,
      },
      summary,
    };
  }

  async checkDatabase(): Promise<{ status: 'up' | 'down' | 'degraded'; error?: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { status: 'down', error: msg };
    }
  }

  private async checkDatabaseWithLatency(): Promise<{
    status: 'up' | 'down' | 'degraded';
    latencyMs?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { status: 'down', latencyMs: Date.now() - start, error: msg };
    }
  }

  /**
   * Latency-measured Redis PING probe.
   *
   * - Connection is read from `REDIS_URL`, falling back to `REDIS_HOST` /
   *   `REDIS_PORT` (the pair used by docker-compose).
   * - When nothing is configured the probe returns `not_configured` and does
   *   not open a socket.
   * - A configured but unreachable Redis (bad URL, refused connection, PING
   *   timeout) returns `down` with the error message.
   */
  async checkRedis(): Promise<RedisHealthStatus> {
    const url = this.getRedisUrl();
    if (!url) {
      return { status: 'not_configured' };
    }

    const start = Date.now();
    try {
      await this.pingRedis(url, HealthService.REDIS_PING_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { status: 'down', latencyMs: Date.now() - start, error: msg };
    }
  }

  /**
   * Resolve the Redis connection string. Prefers `REDIS_URL`; falls back to
   * building one from `REDIS_HOST` / `REDIS_PORT`. Returns `undefined` when
   * Redis is not configured.
   */
  private getRedisUrl(): string | undefined {
    const url = process.env.REDIS_URL?.trim();
    if (url) return url;

    const host = process.env.REDIS_HOST?.trim();
    if (host) {
      const port = process.env.REDIS_PORT?.trim() || '6379';
      return `redis://${host}:${port}`;
    }
    return undefined;
  }

  /**
   * Send a single Redis PING over a short-lived socket and resolve when the
   * server replies `+PONG`. Uses only Node built-ins (`net` / `tls`) so the
   * health probe adds no runtime dependency.
   *
   * Supports `redis://` and `rediss://` (TLS), and `AUTH` when the URL carries
   * a username / password. The socket is always torn down. Extracted as a
   * protected method so tests can stub it.
   *
   * @throws when the URL is invalid, the connection fails, the reply is not
   *   `+PONG`, or the probe exceeds `timeoutMs`.
   */
  protected pingRedis(url: string, timeoutMs: number): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return Promise.reject(new Error(`Invalid Redis URL: ${url}`));
    }

    const useTls = parsed.protocol === 'rediss:';
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 6379;
    const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
    const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;

    return new Promise<void>((resolve, reject) => {
      const socket = useTls
        ? tls.connect({ host, port, servername: host })
        : net.createConnection({ host, port });

      let settled = false;
      let buffer = '';
      // When a password is present we AUTH first, then PING.
      let awaitingAuth = password !== undefined;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };

      socket.setTimeout(timeoutMs, () =>
        finish(new Error(`Redis PING timed out after ${timeoutMs}ms`)),
      );
      socket.on('error', finish);

      const onConnect = () => {
        if (password !== undefined) {
          const authCmd =
            username !== undefined
              ? `AUTH ${username} ${password}\r\n`
              : `AUTH ${password}\r\n`;
          socket.write(authCmd);
        } else {
          socket.write('PING\r\n');
        }
      };
      socket.once(useTls ? 'secureConnect' : 'connect', onConnect);

      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const eol = buffer.indexOf('\r\n');
        if (eol === -1) return; // wait for a complete reply line

        const line = buffer.slice(0, eol);
        // RESP error reply, e.g. "-NOAUTH Authentication required".
        if (line.startsWith('-')) {
          finish(new Error(line.slice(1)));
          return;
        }
        if (awaitingAuth) {
          // AUTH acknowledged (+OK); reset and send the PING.
          awaitingAuth = false;
          buffer = '';
          socket.write('PING\r\n');
          return;
        }
        if (line.startsWith('+PONG')) {
          finish();
        } else {
          finish(new Error(`Unexpected PING reply: ${line}`));
        }
      });
    });
  }

  async checkSorobanRpc(): Promise<SorobanHealthStatus> {
    return this.sorobanRpcService.checkConnectivity();
  }

  async checkSorobanContract(): Promise<SorobanHealthStatus> {
    return this.sorobanRpcService.checkKnownContract();
  }

  getQueueMetrics(): { timestamp: string; queues: QueueSnapshot } {
    return {
      timestamp: new Date().toISOString(),
      queues: this.queueMetrics.snapshot(),
    };
  }

  private readonly HEALTH_CHECKS = [
    { name: 'app', endpoint: '/health' },
    { name: 'detailed', endpoint: '/health/detailed' },
    { name: 'aggregate', endpoint: '/health/aggregate' },
    { name: 'db', endpoint: '/health/db' },
    { name: 'redis', endpoint: '/health/redis' },
    { name: 'soroban', endpoint: '/health/soroban' },
    { name: 'soroban-contract', endpoint: '/health/soroban-contract' },
    { name: 'queue-metrics', endpoint: '/health/queue-metrics' },
  ];

  getHealthChecks(page = 1, limit = 20) {
    const start = (page - 1) * limit;
    const data = this.HEALTH_CHECKS.slice(start, start + limit);
    return { data, total: this.HEALTH_CHECKS.length, page, limit };
  }
}

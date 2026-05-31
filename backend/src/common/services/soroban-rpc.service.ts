import { rpc, nativeToScVal, scValToNative, xdr, Address } from '@stellar/stellar-sdk';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { RpcMetricsService } from './rpc-metrics.service';

export type HealthStatusType = 'up' | 'down' | 'degraded';

export interface RpcHealthDetails {
  attempts: number;
  successCount: number;
  failureCount: number;
  lastError?: string;
  avgResponseTime?: number;
  slowResponses?: number;
}

export interface SorobanHealthStatus {
  status: HealthStatusType;
  timestamp: string;
  rpcUrl?: string;
  ledger?: number;
  responseTime?: number;
  error?: string;
  details?: RpcHealthDetails;
}

export interface RetryConfig {
  retries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxRetryDelayMs: number;
}

const SLOW_RESPONSE_THRESHOLD_MS = 3000;
const DEGRADED_SLOW_RESPONSE_RATIO = 0.5;

@Injectable()
export class SorobanRpcService {
  private readonly logger = new Logger(SorobanRpcService.name);
  private readonly server: rpc.Server | null;
  private readonly rpcUrl: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;

  constructor(@Optional() private readonly rpcMetrics?: RpcMetricsService) {
    this.rpcUrl =
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.timeout = parseInt(process.env.SOROBAN_RPC_TIMEOUT || '5000', 10);
    this.retryConfig = {
      retries: parseInt(process.env.SOROBAN_RPC_RETRIES || '3', 10),
      retryDelayMs: parseInt(
        process.env.SOROBAN_RPC_RETRY_DELAY_MS || '1000',
        10,
      ),
      backoffMultiplier: parseFloat(
        process.env.SOROBAN_RPC_BACKOFF_MULTIPLIER || '2',
      ),
      maxRetryDelayMs: parseInt(
        process.env.SOROBAN_RPC_MAX_RETRY_DELAY_MS || '10000',
        10,
      ),
    };

    try {
      this.server = new rpc.Server(this.rpcUrl, { allowHttp: true });
    } catch {
      this.server = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateRetryDelay(attempt: number): number {
    const delay =
      this.retryConfig.retryDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxRetryDelayMs);
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error('RPC connection timeout')),
          this.timeout,
        ),
      ),
    ]);
  }

  private async recordRpcCall<T>(method: string, call: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();

    try {
      const result = await this.withTimeout(call());
      const latencyMs = Date.now() - startedAt;
      this.rpcMetrics?.record(method, true, latencyMs);
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      this.rpcMetrics?.record(method, false, latencyMs);
      throw err;
    }
  }

  /**
   * Verifies connectivity to the Soroban RPC node by calling getHealth().
   * Retries up to retryConfig.retries times with exponential back-off.
   * Returns:
   *   - 'up'       — first attempt succeeded quickly
   *   - 'degraded' — succeeded after retries, or responses were slow
   *   - 'down'     — all attempts failed (suitable for HTTP 503)
   */
  async checkConnectivity(): Promise<SorobanHealthStatus> {
    const timestamp = new Date().toISOString();

    if (!this.server) {
      return {
        status: 'down',
        timestamp,
        rpcUrl: this.rpcUrl,
        error: 'Failed to initialize Soroban RPC server',
        details: {
          attempts: 0,
          successCount: 0,
          failureCount: 1,
          lastError: 'Server initialization failed',
        },
      };
    }

    const responseTimes: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    let lastError: string | undefined;
    let lastLedger = 0;

    for (let attempt = 1; attempt <= this.retryConfig.retries; attempt++) {
      const startTime = Date.now();
      try {
const health = await this.recordRpcCall('getHealth', () =>
        this.server!.getHealth(),
      );
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        successCount++;
        lastLedger =
          (health as rpc.Api.GetHealthResponse & { ledger?: number }).ledger ??
          0;

        this.logger.debug(
          `RPC connectivity check attempt ${attempt}/${this.retryConfig.retries} succeeded in ${responseTime}ms`,
        );

        // Fast path: first attempt, fast response
        if (attempt === 1 && responseTime < SLOW_RESPONSE_THRESHOLD_MS) {
          return {
            status: 'up',
            timestamp,
            rpcUrl: this.rpcUrl,
            ledger: lastLedger,
            responseTime,
            details: {
              attempts: 1,
              successCount: 1,
              failureCount: 0,
              avgResponseTime: responseTime,
            },
          };
        }
        break;
      } catch (err) {
        failureCount++;
        lastError = (err as Error).message || 'Unknown error';
        responseTimes.push(this.timeout);
        this.logger.warn(
          `RPC connectivity check attempt ${attempt}/${this.retryConfig.retries} failed: ${lastError}`,
        );
        if (attempt < this.retryConfig.retries) {
          await this.delay(this.calculateRetryDelay(attempt));
        }
      }
    }

    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          )
        : undefined;

    const slowResponses = responseTimes.filter(
      (t) => t >= SLOW_RESPONSE_THRESHOLD_MS,
    ).length;
    const slowRatio =
      responseTimes.length > 0 ? slowResponses / responseTimes.length : 0;

    if (successCount === 0) {
      return {
        status: 'down',
        timestamp,
        rpcUrl: this.rpcUrl,
        responseTime: avgResponseTime,
        error: lastError || `RPC unreachable after ${this.retryConfig.retries} attempts`,
        details: {
          attempts: this.retryConfig.retries,
          successCount: 0,
          failureCount,
          lastError,
          avgResponseTime,
        },
      };
    }

    if (failureCount > 0 || slowRatio >= DEGRADED_SLOW_RESPONSE_RATIO) {
      return {
        status: 'degraded',
        timestamp,
        rpcUrl: this.rpcUrl,
        ledger: lastLedger,
        responseTime: avgResponseTime,
        error:
          failureCount > 0
            ? `${failureCount} of ${this.retryConfig.retries} attempts failed`
            : 'Slow response times detected',
        details: {
          attempts: this.retryConfig.retries,
          successCount,
          failureCount,
          lastError,
          avgResponseTime,
          slowResponses,
        },
      };
    }

    return {
      status: 'up',
      timestamp,
      rpcUrl: this.rpcUrl,
      ledger: lastLedger,
      responseTime: avgResponseTime,
      details: {
        attempts: this.retryConfig.retries,
        successCount,
        failureCount: 0,
        avgResponseTime,
      },
    };
  }

  /**
   * Verifies that a known Soroban contract is reachable by reading a ledger
   * entry. Falls back to a getHealth() probe when SOROBAN_HEALTH_CHECK_CONTRACT
   * is not configured.
   */
  async checkKnownContract(): Promise<SorobanHealthStatus> {
    const timestamp = new Date().toISOString();

    if (!this.server) {
      return {
        status: 'down',
        timestamp,
        rpcUrl: this.rpcUrl,
        error: 'Failed to initialize Soroban RPC server',
        details: {
          attempts: 0,
          successCount: 0,
          failureCount: 1,
          lastError: 'Server initialization failed',
        },
      };
    }

    const contractId = process.env.SOROBAN_HEALTH_CHECK_CONTRACT?.trim();
    if (!contractId) {
      // No contract configured — fall back to a plain connectivity probe
      const rpcStatus = await this.checkConnectivity();
      return {
        ...rpcStatus,
        error: rpcStatus.error ?? 'SOROBAN_HEALTH_CHECK_CONTRACT not configured — using RPC connectivity as fallback',
      };
    }

    const responseTimes: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.retryConfig.retries; attempt++) {
      const startTime = Date.now();
      try {
        await this.recordRpcCall('getLedgerEntries', () =>
          this.readContractUInt32(contractId, 0),
        );
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        successCount++;

        this.logger.debug(
          `Contract health check attempt ${attempt}/${this.retryConfig.retries} succeeded in ${responseTime}ms`,
        );

        if (attempt === 1 && responseTime < SLOW_RESPONSE_THRESHOLD_MS) {
          return {
            status: 'up',
            timestamp,
            rpcUrl: this.rpcUrl,
            responseTime,
            details: {
              attempts: 1,
              successCount: 1,
              failureCount: 0,
              avgResponseTime: responseTime,
            },
          };
        }
        break;
      } catch (err) {
        failureCount++;
        lastError = (err as Error).message || 'Unknown error';
        responseTimes.push(this.timeout);
        this.logger.warn(
          `Contract health check attempt ${attempt}/${this.retryConfig.retries} failed: ${lastError}`,
        );
        if (attempt < this.retryConfig.retries) {
          await this.delay(this.calculateRetryDelay(attempt));
        }
      }
    }

    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          )
        : undefined;

    const slowResponses = responseTimes.filter(
      (t) => t >= SLOW_RESPONSE_THRESHOLD_MS,
    ).length;
    const slowRatio =
      responseTimes.length > 0 ? slowResponses / responseTimes.length : 0;

    if (successCount === 0) {
      return {
        status: 'down',
        timestamp,
        rpcUrl: this.rpcUrl,
        responseTime: avgResponseTime,
        error: lastError || `Contract check failed after ${this.retryConfig.retries} attempts`,
        details: {
          attempts: this.retryConfig.retries,
          successCount: 0,
          failureCount,
          lastError,
          avgResponseTime,
        },
      };
    }

    if (failureCount > 0 || slowRatio >= DEGRADED_SLOW_RESPONSE_RATIO) {
      return {
        status: 'degraded',
        timestamp,
        rpcUrl: this.rpcUrl,
        responseTime: avgResponseTime,
        error:
          failureCount > 0
            ? `${failureCount} of ${this.retryConfig.retries} attempts failed`
            : 'Slow response times detected',
        details: {
          attempts: this.retryConfig.retries,
          successCount,
          failureCount,
          lastError,
          avgResponseTime,
          slowResponses,
        },
      };
    }

    return {
      status: 'up',
      timestamp,
      rpcUrl: this.rpcUrl,
      responseTime: avgResponseTime,
      details: {
        attempts: this.retryConfig.retries,
        successCount,
        failureCount: 0,
        avgResponseTime,
      },
    };
  }

  /**
   * Read a u32 value from a Soroban contract persistent storage entry.
   * Returns null when the entry does not exist or on any RPC error.
   */
  async readContractUInt32(
    contractId: string,
    key: number,
  ): Promise<number | null> {
    if (!this.server) return null;
    try {
      const keyScVal: xdr.ScVal = nativeToScVal(key, { type: 'u32' });
      const ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: new Address(contractId).toScAddress(),
          key: keyScVal,
          durability: xdr.ContractDataDurability.persistent(),
        }),
      );
      const response = await this.recordRpcCall('getLedgerEntries', () =>
        this.server!.getLedgerEntries(ledgerKey),
      );
      if (!response.entries?.length) return null;
      const contractData = response.entries[0].val.contractData();
      return scValToNative(contractData.val()) as number;
    } catch {
      return null;
    }
  }

  /**
   * Returns the latest ledger sequence number from the Soroban RPC node.
   * Throws on network failure so callers can decide how to handle stale state.
   */
  async getLatestLedgerSequence(): Promise<number> {
    if (!this.server) {
      throw new Error('SorobanRpcService: server not initialized');
    }
    try {
      const health = await this.recordRpcCall('getHealth', () =>
        this.server!.getHealth(),
      );
      const seq = (
        health as rpc.Api.GetHealthResponse & { ledger?: number }
      ).ledger;
      if (typeof seq !== 'number' || seq <= 0) {
        throw new Error(
          'SorobanRpcService: invalid ledger sequence in health response',
        );
      }
      return seq;
    } catch (err) {
      this.logger.error(`getLatestLedgerSequence failed: ${err}`);
      throw err;
    }
  }

  /**
   * Fetches contract events from the Soroban RPC node.
   */
  async getNetworkEvents(opts: {
    startLedger: number;
    limit?: number;
    paginationToken?: string;
  }): Promise<{
    events: rpc.Api.EventResponse[];
    startLedger: number;
    latestLedger: number;
    nextToken?: string;
  }> {
    if (!this.server) {
      throw new Error('SorobanRpcService: server not initialized');
    }
    const { startLedger, limit = 200, paginationToken } = opts;
    try {
      const response = await this.recordRpcCall('getEvents', () =>
        this.server!.getEvents({
          startLedger,
          filters: [],
          limit,
          ...(paginationToken ? { cursor: paginationToken } : {}),
        }),
      );
      return {
        events: response.events ?? [],
        startLedger: response.latestLedger,
        latestLedger: response.latestLedger,
        nextToken: (response as any).cursor ?? undefined,
      };
    } catch (err) {
      this.logger.error(
        `getNetworkEvents failed (startLedger=${startLedger}): ${err}`,
      );
      throw err;
    }
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  getTimeout(): number {
    return this.timeout;
  }

  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}

import { rpc, nativeToScVal, scValToNative, xdr, Address } from '@stellar/stellar-sdk';
import { Injectable, Logger } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';

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

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    retries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    maxRetryDelayMs: 10000,
};

const SLOW_RESPONSE_THRESHOLD_MS = 3000;
const DEGRADED_SLOW_RESPONSE_THRESHOLD = 0.5; // 50% of responses are slow

@Injectable()
export class SorobanRpcService {
    private readonly server: rpc.Server;
    private readonly logger = new Logger(SorobanRpcService.name);
    private readonly server: any;
    private readonly rpcUrl: string;
    private readonly timeout: number;
    private readonly retryConfig: RetryConfig;

    constructor() {
        this.rpcUrl = process.env.SOROBAN_RPC_URL || 'https://horizon-futurenet.stellar.org';
        this.timeout = parseInt(process.env.SOROBAN_RPC_TIMEOUT || '5000');
        
        this.retryConfig = {
            retries: parseInt(process.env.SOROBAN_RPC_RETRIES || '3'),
            retryDelayMs: parseInt(process.env.SOROBAN_RPC_RETRY_DELAY_MS || '1000'),
            backoffMultiplier: parseFloat(process.env.SOROBAN_RPC_BACKOFF_MULTIPLIER || '2'),
            maxRetryDelayMs: parseInt(process.env.SOROBAN_RPC_MAX_RETRY_DELAY_MS || '10000'),
        };

        try {
            this.server = new StellarSdk.Horizon.Server(this.rpcUrl, { allowHttp: true });
        } catch (error) {
            this.server = null;
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private calculateRetryDelay(attempt: number): number {
        const delay = this.retryConfig.retryDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        return Math.min(delay, this.retryConfig.maxRetryDelayMs);
    }

    async checkConnectivity(): Promise<SorobanHealthStatus> {
        const timestamp = new Date().toISOString();
        const responseTimes: number[] = [];
        let successCount = 0;
        let failureCount = 0;
        let lastError: string | undefined;
        let slowResponses = 0;

        try {
            const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
                Promise.race([
                    promise,
                    new Promise<T>((_, reject) =>
                        setTimeout(() => reject(new Error('RPC connection timeout')), this.timeout),
                    ),
                ]);

            const health = await withTimeout(this.server.getHealth());
            const responseTime = Date.now() - startTime;

            // health.ledger is the latest ledger sequence
            const ledger = (health as rpc.Api.GetHealthResponse & { ledger?: number }).ledger ?? 0;

        if (!this.server) {
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                error: 'Failed to initialize Stellar SDK server',
                details: {
                    attempts: 0,
                    successCount: 0,
                    failureCount: 1,
                    lastError: 'Server initialization failed',
                },
            };
        }

        for (let attempt = 1; attempt <= this.retryConfig.retries; attempt++) {
            const startTime = Date.now();
            
            try {
                const ledgerPromise = this.server.ledgers().order('desc').limit(1).call();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('RPC connection timeout')), this.timeout)
                );

                const ledgerResult = await Promise.race([ledgerPromise, timeoutPromise]);
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);

                if (responseTime > SLOW_RESPONSE_THRESHOLD_MS) {
                    slowResponses++;
                }

                successCount++;
                this.logger.debug(`RPC connectivity check attempt ${attempt}/${this.retryConfig.retries} succeeded in ${responseTime}ms`);

                // Early exit on first attempt success with good response time
                if (attempt === 1 && responseTime < SLOW_RESPONSE_THRESHOLD_MS) {
                    return {
                        status: 'up',
                        timestamp,
                        rpcUrl: this.rpcUrl,
                        ledger: ledgerResult.records[0]?.sequence || 0,
                        responseTime,
                        details: {
                            attempts: 1,
                            successCount: 1,
                            failureCount: 0,
                            avgResponseTime: responseTime,
                        },
                    };
                }

                // Exit loop on any success (after first attempt)
                break;

            } catch (error) {
                failureCount++;
                lastError = error.message || 'Unknown error';
                responseTimes.push(this.timeout); // Count timeout as worst case
                this.logger.warn(`RPC connectivity check attempt ${attempt}/${this.retryConfig.retries} failed: ${lastError}`);

                if (attempt < this.retryConfig.retries) {
                    const retryDelay = this.calculateRetryDelay(attempt);
                    this.logger.debug(`Retrying in ${retryDelay}ms...`);
                    await this.delay(retryDelay);
                }
            }
        }

        // Determine status based on results
        const avgResponseTime = responseTimes.length > 0 
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : undefined;

        const slowResponseRatio = responseTimes.length > 0 ? slowResponses / responseTimes.length : 0;

        if (successCount === 0) {
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                ledger,
                responseTime,
            };
        } catch (error) {
                responseTime: avgResponseTime,
                error: lastError || `RPC unreachable after ${this.retryConfig.retries} attempts`,
                details: {
                    attempts: this.retryConfig.retries,
                    successCount,
                    failureCount,
                    lastError,
                    avgResponseTime,
                },
            };
        }

        // Check for degraded status (some failures or slow responses)
        if (failureCount > 0 || slowResponseRatio >= DEGRADED_SLOW_RESPONSE_THRESHOLD) {
            return {
                status: 'degraded',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime: Date.now() - startTime,
                error: (error as Error).message || 'Unknown error',
                responseTime: avgResponseTime,
                error: failureCount > 0 
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
     * Read a u32 value from a Soroban contract.
     * Uses nativeToScVal to encode the key as a UInt32 ScVal and
     * scValToNative to decode the returned ScVal back to a number.
     */
    async readContractUInt32(contractId: string, key: number): Promise<number | null> {
        try {
            const keyScVal: xdr.ScVal = nativeToScVal(key, { type: 'u32' });
            const ledgerKey = xdr.LedgerKey.contractData(
                new xdr.LedgerKeyContractData({
                    contract: new Address(contractId).toScAddress(),
                    key: keyScVal,
                    durability: xdr.ContractDataDurability.persistent(),
                }),
            );

            const response = await this.server.getLedgerEntries(ledgerKey);
            if (!response.entries?.length) return null;

            const entry = response.entries[0];
            const contractData = entry.val.contractData();
            return scValToNative(contractData.val()) as number;
        } catch {
            return null;
        }
    }

    async checkKnownContract(): Promise<SorobanHealthStatus> {
        const timestamp = new Date().toISOString();
        const responseTimes: number[] = [];
        let successCount = 0;
        let failureCount = 0;
        let lastError: string | undefined;
        let slowResponses = 0;

        try {
            const contractId = process.env.SOROBAN_HEALTH_CHECK_CONTRACT;
            if (!contractId) {
                throw new Error('SOROBAN_HEALTH_CHECK_CONTRACT not configured');
            }

            await this.readContractUInt32(contractId, 0);
        if (!this.server) {
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                error: 'Failed to initialize Stellar SDK server',
                details: {
                    attempts: 0,
                    successCount: 0,
                    failureCount: 1,
                    lastError: 'Server initialization failed',
                },
            };
        }

        for (let attempt = 1; attempt <= this.retryConfig.retries; attempt++) {
            const startTime = Date.now();
            
            try {
                const contractId = process.env.SOROBAN_HEALTH_CHECK_CONTRACT;
                
                // Use a generic RPC call to verify connectivity to the network
                const accountPromise = this.server.loadAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Contract read timeout')), this.timeout)
                );

                await Promise.race([accountPromise, timeoutPromise]);
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);

                if (responseTime > SLOW_RESPONSE_THRESHOLD_MS) {
                    slowResponses++;
                }

                successCount++;
                this.logger.debug(`RPC contract check attempt ${attempt}/${this.retryConfig.retries} succeeded in ${responseTime}ms`);

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

                // Exit loop on any success (after first attempt)
                break;

            } catch (error) {
                failureCount++;
                lastError = error.message || 'Unknown error';
                responseTimes.push(this.timeout);
                this.logger.warn(`RPC contract check attempt ${attempt}/${this.retryConfig.retries} failed: ${lastError}`);

                if (attempt < this.retryConfig.retries) {
                    const retryDelay = this.calculateRetryDelay(attempt);
                    this.logger.debug(`Retrying in ${retryDelay}ms...`);
                    await this.delay(retryDelay);
                }
            }
        }

        const avgResponseTime = responseTimes.length > 0 
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : undefined;

        const slowResponseRatio = responseTimes.length > 0 ? slowResponses / responseTimes.length : 0;

        if (successCount === 0) {
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime: Date.now() - startTime,
            };
        } catch (error) {
                responseTime: avgResponseTime,
                error: lastError || `Contract check failed after ${this.retryConfig.retries} attempts`,
                details: {
                    attempts: this.retryConfig.retries,
                    successCount,
                    failureCount,
                    lastError,
                    avgResponseTime,
                },
            };
        }

        if (failureCount > 0 || slowResponseRatio >= DEGRADED_SLOW_RESPONSE_THRESHOLD) {
            return {
                status: 'degraded',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime: Date.now() - startTime,
                error: (error as Error).message || 'Unknown error',
                responseTime: avgResponseTime,
                error: failureCount > 0 
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

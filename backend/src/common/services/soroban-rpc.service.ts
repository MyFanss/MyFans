import { Injectable } from '@nestjs/common';
import { rpc, nativeToScVal, scValToNative, xdr, Address } from '@stellar/stellar-sdk';

export interface SorobanHealthStatus {
    status: 'up' | 'down';
    timestamp: string;
    rpcUrl?: string;
    ledger?: number;
    responseTime?: number;
    error?: string;
}

@Injectable()
export class SorobanRpcService {
    private readonly server: rpc.Server;
    private readonly rpcUrl: string;
    private readonly timeout: number;

    constructor() {
        this.rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
        this.timeout = parseInt(process.env.SOROBAN_RPC_TIMEOUT || '5000');
        this.server = new rpc.Server(this.rpcUrl, { allowHttp: true });
    }

    async checkConnectivity(): Promise<SorobanHealthStatus> {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();

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

            return {
                status: 'up',
                timestamp,
                rpcUrl: this.rpcUrl,
                ledger,
                responseTime,
            };
        } catch (error) {
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime: Date.now() - startTime,
                error: (error as Error).message || 'Unknown error',
            };
        }
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
        const startTime = Date.now();
        const timestamp = new Date().toISOString();

        try {
            const contractId = process.env.SOROBAN_HEALTH_CHECK_CONTRACT;
            if (!contractId) {
                throw new Error('SOROBAN_HEALTH_CHECK_CONTRACT not configured');
            }

            await this.readContractUInt32(contractId, 0);
            return {
                status: 'up',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime: Date.now() - startTime,
            };
        } catch (error) {
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime: Date.now() - startTime,
                error: (error as Error).message || 'Unknown error',
            };
        }
    }

    getRpcUrl(): string {
        return this.rpcUrl;
    }

    getTimeout(): number {
        return this.timeout;
    }
}

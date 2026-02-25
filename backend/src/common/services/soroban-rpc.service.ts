import { Injectable } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';

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
    private readonly server: any;
    private readonly rpcUrl: string;
    private readonly timeout: number;

    constructor() {
        // Use Soroban Futurenet RPC URL by default, can be configured via environment
        this.rpcUrl = process.env.SOROBAN_RPC_URL || 'https://horizon-futurenet.stellar.org';
        this.timeout = parseInt(process.env.SOROBAN_RPC_TIMEOUT || '5000'); // 5 seconds default
        
        try {
            this.server = new StellarSdk.Horizon.Server(this.rpcUrl, { allowHttp: true });
        } catch (error) {
            // If server creation fails, we'll handle it in the health check
            this.server = null;
        }
    }

    async checkConnectivity(): Promise<SorobanHealthStatus> {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();

        try {
            if (!this.server) {
                throw new Error('Failed to initialize Stellar SDK server');
            }

            // Use Promise.race to implement timeout
            const ledgerPromise = this.server.loadAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('RPC connection timeout')), this.timeout)
            );

            await Promise.race([ledgerPromise, timeoutPromise]);
            
            // If we got here, let's try to get the latest ledger
            const ledgerPromise2 = this.server.ledgers().order('desc').limit(1).call();
            const timeoutPromise2 = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('RPC connection timeout')), this.timeout)
            );

            const ledgerResult = await Promise.race([ledgerPromise2, timeoutPromise2]);
            const responseTime = Date.now() - startTime;

            return {
                status: 'up',
                timestamp,
                rpcUrl: this.rpcUrl,
                ledger: ledgerResult.records[0]?.sequence || 0,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime,
                error: error.message || 'Unknown error',
            };
        }
    }

    async checkKnownContract(): Promise<SorobanHealthStatus> {
        const startTime = Date.now();
        const timestamp = new Date().toISOString();

        try {
            if (!this.server) {
                throw new Error('Failed to initialize Stellar SDK server');
            }

            // Try to read a known contract on Soroban Futurenet
            // This is a placeholder contract address - replace with actual contract
            const contractId = process.env.SOROBAN_HEALTH_CHECK_CONTRACT || 
                'CA3D5KRYM6CB7OWQ6TWKRRJZ4LW5DZ5Z2J5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ5JQ';
            
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Contract read timeout')), this.timeout)
            );

            // For now, we'll just check if we can make any RPC call
            // In a real implementation, you would use the Soroban RPC to read contract state
            const ledgerPromise = this.server.loadAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
            await Promise.race([ledgerPromise, timeoutPromise]);
            
            const responseTime = Date.now() - startTime;

            return {
                status: 'up',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime,
                error: 'Contract check not fully implemented - using account check as fallback',
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                status: 'down',
                timestamp,
                rpcUrl: this.rpcUrl,
                responseTime,
                error: error.message || 'Unknown error',
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

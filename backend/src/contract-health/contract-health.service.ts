import { Injectable, Logger } from '@nestjs/common';

export interface ContractCheckResult {
  contract: string;
  contractId: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}

@Injectable()
export class ContractHealthService {
  private readonly logger = new Logger(ContractHealthService.name);
  private up = 0;
  private readonly rpcUrl =
    process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

  async checkContract(
    name: string,
    contractId: string,
    method: string,
    params: unknown[] = [],
  ): Promise<ContractCheckResult> {
    if (!contractId) {
      this.up = 0;
      return {
        contract: name,
        contractId,
        ok: false,
        error: 'Contract ID is empty',
        durationMs: 0,
      };
    }

    const start = Date.now();

    try {
      const body = {
        jsonrpc: '2.0',
        id: 1,
        method: 'simulateTransaction',
        params: [
          {
            transaction: this.buildInvokeXdr(contractId, method, params),
          },
        ],
      };

      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        this.up = 0;
        return {
          contract: name,
          contractId,
          ok: false,
          error: `HTTP ${res.status}`,
          durationMs,
        };
      }

      const json = (await res.json()) as {
        error?: { message: string };
        result?: unknown;
      };

      if (json.error) {
        this.up = 0;
        return {
          contract: name,
          contractId,
          ok: false,
          error: json.error.message,
          durationMs,
        };
      }

      this.logger.log(`Contract check passed: ${name} (${durationMs}ms)`);
      this.up = 1;
      return { contract: name, contractId, ok: true, durationMs };
    } catch (err) {
      this.up = 0;
      const durationMs = Date.now() - start;
      return {
        contract: name,
        contractId,
        ok: false,
        error: (err as Error).message,
        durationMs,
      };
    }
  }

  getUpGauge(): number {
    return this.up;
  }

  // Minimal XDR stub — in real usage replace with @stellar/stellar-sdk TransactionBuilder
  private buildInvokeXdr(
    contractId: string,
    method: string,
    _params: unknown[],
  ): string {
    void _params;
    // Returns a placeholder; real XDR built by stellar-sdk in production
    return `invoke:${contractId}:${method}`;
  }
}

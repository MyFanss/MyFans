import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StartupProbeService {
  private readonly logger = new Logger(StartupProbeService.name);

  private get config() {
    return {
      mode: (process.env.STARTUP_MODE || 'degraded') as 'fail-fast' | 'degraded',
      db: {
        enabled: process.env.STARTUP_PROBE_DB !== 'false',
        retries: parseInt(process.env.STARTUP_DB_RETRIES || '5'),
        retryDelayMs: parseInt(process.env.STARTUP_DB_RETRY_DELAY_MS || '2000'),
      },
      rpc: {
        enabled: process.env.STARTUP_PROBE_RPC !== 'false',
        url: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
        retries: parseInt(process.env.STARTUP_RPC_RETRIES || '3'),
        retryDelayMs: parseInt(process.env.STARTUP_RPC_RETRY_DELAY_MS || '2000'),
      },
    };
  }

  async probeDb(
    checkFn: () => Promise<void>,
  ): Promise<{ ok: boolean; error?: string }> {
    const { db } = this.config;
    if (!db.enabled) {
      this.logger.log('DB probe disabled, skipping');
      return { ok: true };
    }

    const { retries, retryDelayMs } = db;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await checkFn();
        this.logger.log('DB probe passed');
        return { ok: true };
      } catch (err) {
        this.logger.warn(
          `DB probe attempt ${attempt}/${retries} failed: ${err.message}`,
        );
        if (attempt < retries) {
          await this.delay(retryDelayMs);
        }
      }
    }

    const error = `DB unreachable after ${retries} attempts`;
    return { ok: false, error };
  }

  async probeRpc(): Promise<{ ok: boolean; error?: string }> {
    const { rpc } = this.config;
    if (!rpc.enabled) {
      this.logger.log('RPC probe disabled, skipping');
      return { ok: true };
    }

    const { url, retries, retryDelayMs } = rpc;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.logger.log('RPC probe passed');
        return { ok: true };
      } catch (err) {
        this.logger.warn(
          `RPC probe attempt ${attempt}/${retries} failed: ${err.message}`,
        );
        if (attempt < retries) {
          await this.delay(retryDelayMs);
        }
      }
    }

    const error = `RPC unreachable after ${retries} attempts`;
    return { ok: false, error };
  }

  handleResult(name: string, result: { ok: boolean; error?: string }): void {
    if (result.ok) return;

    if (this.config.mode === 'fail-fast') {
      this.logger.error(`[fail-fast] ${result.error} — shutting down`);
      process.exit(1);
    } else {
      this.logger.warn(`[degraded] ${result.error} — continuing in degraded mode`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { MetricsService } from './metrics.service';

/**
 * Wrap an async RPC call and record count, latency, and errors.
 * Use for Soroban RPC or any external RPC. No PII in operation label.
 *
 * @param metrics - MetricsService (inject where RPC is used)
 * @param operation - Label for the operation (e.g. 'getLedger', 'simulate'). Do not include user/account IDs.
 */
export async function withRpcMetrics<T>(
  metrics: MetricsService,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    metrics.recordRpcCall(
      operation,
      (performance.now() - start) / 1000,
      false,
    );
    return result;
  } catch (err) {
    metrics.recordRpcCall(
      operation,
      (performance.now() - start) / 1000,
      true,
    );
    throw err;
  }
}

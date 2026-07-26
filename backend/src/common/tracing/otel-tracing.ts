/**
 * Optional OpenTelemetry trace export for critical routes (auth, checkout,
 * webhook). Disabled by default — enable with OTEL_ENABLED=true.
 *
 * This module has no hard dependency on @opentelemetry/* packages: the SDK
 * is loaded lazily via require() only when tracing is enabled, so the app
 * runs unchanged when the packages aren't installed or OTEL_ENABLED is unset.
 *
 * Wiring (not applied automatically — call from main.ts bootstrap):
 *   import { initTracing, withSpan } from './common/tracing/otel-tracing';
 *   await initTracing();
 *
 * Span usage inside a critical route handler:
 *   return withSpan('auth.login', () => this.authService.login(dto));
 */

export const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

export const CRITICAL_ROUTES = [
  'auth.login',
  'auth.register',
  'auth.challenge',
  'auth.challenge.verify',
  'checkout.create',
  'checkout.confirm',
  'webhook.receive',
] as const;

export type CriticalRoute = (typeof CRITICAL_ROUTES)[number];

let sdk: { shutdown: () => Promise<void> } | undefined;

/**
 * Initialize the OTel Node SDK if OTEL_ENABLED=true. No-op otherwise.
 * Requires OTEL_EXPORTER_OTLP_ENDPOINT to be set when enabled.
 */
export async function initTracing(): Promise<void> {
  if (!OTEL_ENABLED) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

    const exporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });

    sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'myfans-backend',
      traceExporter: exporter,
    });

    await (sdk as unknown as { start: () => Promise<void> }).start();
  } catch (err) {
    // OTel packages not installed or failed to start — tracing stays disabled.
    // eslint-disable-next-line no-console
    console.warn('[otel-tracing] tracing disabled:', (err as Error).message);
  }
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}

/**
 * Wrap a critical-route handler in a named span when tracing is enabled.
 * Falls back to plain execution when OTel isn't active.
 */
export async function withSpan<T>(
  name: CriticalRoute | string,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!OTEL_ENABLED) {
    return fn();
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require('@opentelemetry/api');
    const tracer = api.trace.getTracer('myfans-backend');
    return tracer.startActiveSpan(name, async (span: { end: () => void; recordException: (e: unknown) => void }) => {
      try {
        return await fn();
      } catch (err) {
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  } catch {
    return fn();
  }
}

/**
 * Minimal error logger with correlation ID support.
 * Correlation ID comes from Next.js error digest when available,
 * otherwise a random ID is generated per session.
 */

let _sessionId: string | undefined;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  if (!_sessionId) {
    _sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
  return _sessionId;
}

export interface LogPayload {
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export function logError(payload: LogPayload): void {
  const correlationId = payload.correlationId ?? getSessionId();
  const entry = {
    level: 'error',
    correlationId,
    message: payload.message,
    ...(payload.context && { context: payload.context }),
    timestamp: new Date().toISOString(),
  };

  // In production replace this with your real logging service (e.g. Datadog, Sentry).
  if (process.env.NODE_ENV !== 'test') {
    console.error('[MyFans]', JSON.stringify(entry), payload.error ?? '');
  }
}


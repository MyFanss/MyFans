// Plain CJS logger — .cjs extension bypasses SWC transform so exports are writable,
// enabling jest.spyOn(logger, 'logError') in tests.

let _sessionId;

function getSessionId() {
  if (typeof window === 'undefined') return 'ssr';
  if (!_sessionId) {
    _sessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  return _sessionId;
}

function logError(payload) {
  const correlationId = payload.correlationId != null ? payload.correlationId : getSessionId();
  const entry = {
    level: 'error',
    correlationId,
    message: payload.message,
    ...(payload.context && { context: payload.context }),
    timestamp: new Date().toISOString(),
  };
  if (process.env.NODE_ENV !== 'test') {
    console.error('[MyFans]', JSON.stringify(entry), payload.error != null ? payload.error : '');
  }
}

module.exports = { logError, __esModule: true };

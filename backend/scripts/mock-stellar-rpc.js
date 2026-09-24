#!/usr/bin/env node
/**
 * mock-stellar-rpc.js
 *
 * Minimal Stellar/Soroban JSON-RPC 2.0 mock server for CI.
 * Listens on PORT (default 8000) and returns deterministic stub responses
 * so backend and E2E tests never reach the real testnet.
 *
 * Supported methods:
 *   getHealth                  → { status: "healthy" }
 *   getLatestLedger            → { id, sequence, protocolVersion }
 *   getLedgerEntries           → empty entries array
 *   simulateTransaction        → success with bool(true) retval
 *   sendTransaction            → PENDING status
 *   getTransaction             → SUCCESS status
 *   getEvents                  → empty events array
 *
 * Fault injection (for exercising the rpc-adapter retry/timeout/fail-closed
 * policy in tests) is controlled per-request via the `_mock` field on the
 * JSON-RPC params object, or globally via env vars:
 *
 *   MOCK_RPC_FAIL_METHODS   comma-separated methods that always error
 *   MOCK_RPC_FAIL_TIMES     how many times a failing method errors before
 *                           succeeding (default: Infinity → always fail)
 *   MOCK_RPC_DELAY_MS       artificial latency added to every response
 *   MOCK_RPC_TIMEOUT_METHODS comma-separated methods that never respond
 *                           (used to trigger client-side timeouts)
 *
 * Per-request overrides (params._mock):
 *   { fail: true, failTimes: 2, delayMs: 50, timeout: true }
 */

'use strict';

const http = require('http');

const PORT = parseInt(process.env.MOCK_RPC_PORT || '8000', 10);

// XDR-encoded ScVal bool(true) – base64 of the canonical encoding.
// Produced by: StellarSdk.xdr.ScVal.scvBool(true).toXDR('base64')
const BOOL_TRUE_XDR = 'AAAAAAAAAAE=';

function parseList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const FAIL_METHODS = new Set(parseList(process.env.MOCK_RPC_FAIL_METHODS));
const TIMEOUT_METHODS = new Set(parseList(process.env.MOCK_RPC_TIMEOUT_METHODS));
const GLOBAL_DELAY_MS = parseInt(process.env.MOCK_RPC_DELAY_MS || '0', 10);
const GLOBAL_FAIL_TIMES = process.env.MOCK_RPC_FAIL_TIMES
  ? parseInt(process.env.MOCK_RPC_FAIL_TIMES, 10)
  : Infinity;

// Tracks how many times each method has been asked to fail, so tests can
// assert that the adapter retried and eventually succeeded.
const failCounters = new Map();

const HANDLERS = {
  getHealth: () => ({ status: 'healthy' }),

  getLatestLedger: () => ({
    id: 'mock-ledger-hash-0000000000000000000000000000000000000000000000000000000000000000',
    sequence: 1000000,
    protocolVersion: 21,
  }),

  getLedgerEntries: () => ({ entries: [], latestLedger: 1000000 }),

  simulateTransaction: () => ({
    results: [{ auth: [], retval: BOOL_TRUE_XDR }],
    cost: { cpuInsns: '0', memBytes: '0' },
    latestLedger: 1000000,
    minResourceFee: '100',
  }),

  sendTransaction: (_params) => ({
    hash: 'mock-tx-hash-' + Date.now(),
    status: 'PENDING',
    latestLedger: 1000000,
    latestLedgerCloseTime: Math.floor(Date.now() / 1000).toString(),
  }),

  getTransaction: (_params) => ({
    status: 'SUCCESS',
    latestLedger: 1000000,
    latestLedgerCloseTime: Math.floor(Date.now() / 1000).toString(),
    ledger: 1000001,
    createdAt: Math.floor(Date.now() / 1000).toString(),
    applicationOrder: 1,
    feeBump: false,
    envelopeXdr: '',
    resultXdr: '',
    resultMetaXdr: '',
  }),

  getEvents: () => ({ events: [], latestLedger: 1000000 }),
};

function shouldFail(method, mock) {
  if (mock && mock.fail) {
    const limit = typeof mock.failTimes === 'number' ? mock.failTimes : Infinity;
    const seen = failCounters.get(method) || 0;
    failCounters.set(method, seen + 1);
    return seen < limit;
  }
  if (FAIL_METHODS.has(method)) {
    const seen = failCounters.get(method) || 0;
    failCounters.set(method, seen + 1);
    return seen < GLOBAL_FAIL_TIMES;
  }
  return false;
}

function shouldTimeout(method, mock) {
  if (mock && mock.timeout) return true;
  return TIMEOUT_METHODS.has(method);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }

    const { id, method, params } = parsed;
    const mock = params && typeof params === 'object' ? params._mock : undefined;
    const handler = HANDLERS[method];

    const delayMs = (mock && typeof mock.delayMs === 'number' ? mock.delayMs : 0) + GLOBAL_DELAY_MS;

    const respond = () => {
      // Simulated hang: never write a response so the client times out.
      if (shouldTimeout(method, mock)) {
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });

      if (!handler) {
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }));
        return;
      }

      if (shouldFail(method, mock)) {
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: `Injected failure for ${method}` },
        }));
        return;
      }

      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: handler(params),
      }));
    };

    if (delayMs > 0) {
      setTimeout(respond, delayMs);
    } else {
      respond();
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-stellar-rpc] listening on http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

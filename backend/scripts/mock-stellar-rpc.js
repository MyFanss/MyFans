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
 */

'use strict';

const http = require('http');

const PORT = parseInt(process.env.MOCK_RPC_PORT || '8000', 10);

// XDR-encoded ScVal bool(true) – base64 of the canonical encoding.
// Produced by: StellarSdk.xdr.ScVal.scvBool(true).toXDR('base64')
const BOOL_TRUE_XDR = 'AAAAAAAAAAE=';

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
    const handler = HANDLERS[method];

    res.writeHead(200, { 'Content-Type': 'application/json' });

    if (!handler) {
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }));
      return;
    }

    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result: handler(params),
    }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-stellar-rpc] listening on http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

/**
 * Tests for the mock Stellar RPC server used in CI.
 * Starts the server on a random port, sends JSON-RPC requests, and asserts
 * the stub responses match what the backend and E2E tests expect.
 */

import http from 'http';
import { AddressInfo } from 'net';
import { execFile } from 'child_process';
import path from 'path';

const MOCK_SCRIPT = path.resolve(__dirname, '../../scripts/mock-stellar-rpc.js');

function rpcCall(
  port: number,
  method: string,
  params: unknown = {},
): Promise<{ result?: unknown; error?: unknown }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = http.request(
      { hostname: '127.0.0.1', port, method: 'POST', path: '/', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve(JSON.parse(data)));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('mock-stellar-rpc server', () => {
  let proc: ReturnType<typeof execFile>;
  let port: number;

  beforeAll((done) => {
    // Pick a free port by binding to :0 then releasing it.
    const tmp = http.createServer();
    tmp.listen(0, '127.0.0.1', () => {
      port = (tmp.address() as AddressInfo).port;
      tmp.close(() => {
        proc = execFile('node', [MOCK_SCRIPT], {
          env: { ...process.env, MOCK_RPC_PORT: String(port) },
        });

        // Wait until the server is ready.
        const deadline = Date.now() + 10_000;
        const poll = () => {
          rpcCall(port, 'getHealth')
            .then(() => done())
            .catch(() => {
              if (Date.now() < deadline) setTimeout(poll, 100);
              else done(new Error('mock-stellar-rpc did not start in time'));
            });
        };
        setTimeout(poll, 200);
      });
    });
  });

  afterAll(() => {
    proc?.kill();
  });

  it('getHealth returns healthy', async () => {
    const res = await rpcCall(port, 'getHealth');
    expect(res.result).toMatchObject({ status: 'healthy' });
  });

  it('getLatestLedger returns sequence and protocolVersion', async () => {
    const res = await rpcCall(port, 'getLatestLedger');
    expect(res.result).toMatchObject({ sequence: expect.any(Number), protocolVersion: expect.any(Number) });
  });

  it('getLedgerEntries returns empty entries', async () => {
    const res = await rpcCall(port, 'getLedgerEntries');
    expect(res.result).toMatchObject({ entries: [] });
  });

  it('simulateTransaction returns retval and minResourceFee', async () => {
    const res = await rpcCall(port, 'simulateTransaction', { transaction: 'xdr' });
    expect(res.result).toMatchObject({
      results: expect.arrayContaining([expect.objectContaining({ retval: expect.any(String) })]),
      minResourceFee: expect.any(String),
    });
  });

  it('sendTransaction returns PENDING status', async () => {
    const res = await rpcCall(port, 'sendTransaction', { transaction: 'xdr' });
    expect(res.result).toMatchObject({ status: 'PENDING', hash: expect.any(String) });
  });

  it('getTransaction returns SUCCESS status', async () => {
    const res = await rpcCall(port, 'getTransaction', { hash: 'abc' });
    expect(res.result).toMatchObject({ status: 'SUCCESS' });
  });

  it('getEvents returns empty events', async () => {
    const res = await rpcCall(port, 'getEvents');
    expect(res.result).toMatchObject({ events: [] });
  });

  it('unknown method returns JSON-RPC error -32601', async () => {
    const res = await rpcCall(port, 'unknownMethod');
    expect(res.error).toMatchObject({ code: -32601 });
  });
});

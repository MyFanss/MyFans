#!/usr/bin/env ts-node
/**
 * Webhook secret rotation CLI
 *
 * Usage:
 *   ts-node scripts/rotate-webhook-secret.ts rotate <newSecret> [cutoffMs]
 *   ts-node scripts/rotate-webhook-secret.ts expire-previous
 *   ts-node scripts/rotate-webhook-secret.ts sign <secret> <payload>
 *   ts-node scripts/rotate-webhook-secret.ts verify <secret> <payload> <signature> [timestamp] [toleranceMs]
 *
 * Environment:
 *   API_BASE_URL  — base URL of the running backend (default: http://localhost:3000)
 */

import { createHmac, timingSafeEqual } from 'crypto';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';
const [, , command, ...args] = process.argv;

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${BASE}/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('Error:', JSON.stringify(json, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Constant-time comparison of two hex signatures.
 * Returns false on length mismatch without leaking timing information.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a webhook signature against one or more accepted secrets.
 *
 * During rotation both the current and previous secrets are accepted
 * (dual-secret accept window). The signed payload is `${timestamp}.${payload}`
 * so a stale timestamp cannot be replayed against a fresh body.
 */
function verify(
  secrets: string[],
  payload: string,
  signature: string,
  timestamp: string,
  toleranceMs: number,
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > toleranceMs) return false;

  const signedPayload = `${timestamp}.${payload}`;
  return secrets.some((secret) => safeEqual(sign(secret, signedPayload), signature));
}

async function main(): Promise<void> {
  switch (command) {
    case 'rotate': {
      const [newSecret, cutoffMsStr] = args;
      if (!newSecret) {
        console.error('Usage: rotate <newSecret> [cutoffMs]');
        process.exit(1);
      }
      const body: { newSecret: string; cutoffMs?: number } = { newSecret };
      if (cutoffMsStr) body.cutoffMs = parseInt(cutoffMsStr, 10);
      await post('/webhook/rotate', body);
      break;
    }

    case 'expire-previous':
      await post('/webhook/expire-previous', {});
      break;

    case 'sign': {
      const [secret, payload] = args;
      if (!secret || !payload) {
        console.error('Usage: sign <secret> <payload>');
        process.exit(1);
      }
      console.log(sign(secret, payload));
      break;
    }

    case 'verify': {
      const [secret, payload, signature, timestamp, toleranceMsStr] = args;
      if (!secret || !payload || !signature) {
        console.error('Usage: verify <secret> <payload> <signature> [timestamp] [toleranceMs]');
        process.exit(1);
      }
      const ts = timestamp ?? String(Date.now());
      const toleranceMs = toleranceMsStr ? parseInt(toleranceMsStr, 10) : 5 * 60 * 1000;
      const ok = verify([secret], payload, signature, ts, toleranceMs);
      if (!ok) {
        console.error('Invalid signature');
        process.exit(1);
      }
      console.log('OK');
      break;
    }

    default:
      console.error('Commands: rotate | expire-previous | sign | verify');
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

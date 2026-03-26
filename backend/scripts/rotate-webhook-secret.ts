#!/usr/bin/env ts-node
/**
 * Webhook secret rotation CLI
 *
 * Usage:
 *   ts-node scripts/rotate-webhook-secret.ts rotate <newSecret> [cutoffMs]
 *   ts-node scripts/rotate-webhook-secret.ts expire-previous
 *   ts-node scripts/rotate-webhook-secret.ts sign <secret> <payload>
 *
 * Environment:
 *   API_BASE_URL  — base URL of the running backend (default: http://localhost:3000)
 */

import { createHmac } from 'crypto';

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

  default:
    console.error('Commands: rotate | expire-previous | sign');
    process.exit(1);
}

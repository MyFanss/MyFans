#!/usr/bin/env node
/**
 * Tests for `scripts/check-demo-routes.mjs`.
 *
 * The guard reads `process.cwd()` for `.next/`, so each test builds a temporary
 * fixture directory and spawns the script with that directory as the cwd.
 *
 * Run with: `node --test scripts/check-demo-routes.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, 'check-demo-routes.mjs');

/**
 * Create a throwaway fixture directory containing a `.next/` folder.
 * Returns the fixture root (used as the spawn cwd).
 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'check-demo-routes-'));
  mkdirSync(join(root, '.next'), { recursive: true });
  return root;
}

/**
 * Spawn the guard with the fixture as cwd and the given environment overrides.
 */
function runGuard(cwd, env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('exits 0 for a clean production build', () => {
  const root = makeFixture();
  try {
    const result = runGuard(root, { NODE_ENV: 'production' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /no demo routes/);
  } finally {
    cleanup(root);
  }
});

test('exits 1 and names the path when a demo route directory exists', () => {
  const root = makeFixture();
  try {
    mkdirSync(join(root, '.next', 'server', 'app', 'wallet-demo'), {
      recursive: true,
    });
    const result = runGuard(root, { NODE_ENV: 'production' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\.next\/server\/app\/wallet-demo\//);
  } finally {
    cleanup(root);
  }
});

test('exits 1 and names the manifest when it references a demo route', () => {
  const root = makeFixture();
  try {
    writeFileSync(
      join(root, '.next', 'app-path-routes-manifest.json'),
      JSON.stringify({ '/ui': '/ui' }),
    );
    const result = runGuard(root, { NODE_ENV: 'production' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /app-path-routes-manifest\.json references \/ui/);
  } finally {
    cleanup(root);
  }
});

test('exits 0 with the skip warning when NEXT_PUBLIC_FLAG_DEMOS=true', () => {
  const root = makeFixture();
  try {
    mkdirSync(join(root, '.next', 'server', 'app', 'wallet-demo'), {
      recursive: true,
    });
    const result = runGuard(root, {
      NODE_ENV: 'production',
      NEXT_PUBLIC_FLAG_DEMOS: 'true',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /skipping the prod-exclusion check/);
  } finally {
    cleanup(root);
  }
});

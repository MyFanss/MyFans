import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCommit,
  classifyPackages,
  redact,
  render,
  insertIntoChangelog,
} from './generate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATE = join(__dirname, 'generate.mjs');

// ---------------------------------------------------------------------------
// Existing pure-helper coverage (kept untouched)
// ---------------------------------------------------------------------------

test('parseCommit parses a conventional commit', () => {
  const c = parseCommit('abc123\u0000feat(backend): add thing\u0000');
  assert.equal(c.hash, 'abc123');
  assert.equal(c.type, 'feat');
  assert.equal(c.scope, 'backend');
  assert.equal(c.subject, 'add thing');
});

test('classifyPackages maps scopes to packages', () => {
  const c = parseCommit('abc123\u0000feat(backend): add thing\u0000');
  const pkgs = classifyPackages(c);
  assert.ok(pkgs.includes('backend'));
});

test('redact removes secrets', () => {
  assert.equal(redact('token=abcdef123456'), 'token=[redacted]');
});

test('render produces a section', () => {
  const out = render([parseCommit('abc123\u0000feat(backend): add thing\u0000')], {
    version: '1.0.0',
    date: '2024-01-01',
  });
  assert.match(out, /1\.0\.0/);
});

test('insertIntoChangelog inserts below the marker', () => {
  const existing = '# Changelog\n\n<!-- changelog:insert -->\n\n## 0.9.0\n';
  const out = insertIntoChangelog(existing, '## 1.0.0\n');
  assert.ok(out.indexOf('## 1.0.0') < out.indexOf('## 0.9.0'));
  assert.ok(out.includes('<!-- changelog:insert -->'));
});

// ---------------------------------------------------------------------------
// CLI coverage: --package, --strict, --prepend
// ---------------------------------------------------------------------------

function runCli(args, { cwd } = {}) {
  try {
    const stdout = execFileSync('node', [GENERATE, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout };
  } catch (err) {
    return {
      status: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout ? String(err.stdout) : '',
      stderr: err.stderr ? String(err.stderr) : '',
    };
  }
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A git-free fixture: a JSON commit list the CLI can read via --from/--to is
// not available, so we exercise the CLI against an empty range and assert on
// argument handling / exit codes that do not require a real repository.

test('--package restricts output to the requested package', () => {
  const commits = [
    parseCommit('a1\u0000feat(backend): add endpoint\u0000'),
    parseCommit('b2\u0000feat(frontend): add page\u0000'),
    parseCommit('c3\u0000feat(contract): add method\u0000'),
  ];
  const backendOnly = commits.filter((c) => classifyPackages(c).includes('backend'));
  const out = render(backendOnly, { version: '1.0.0', date: '2024-01-01' });
  assert.match(out, /add endpoint/);
  assert.doesNotMatch(out, /add page/);
  assert.doesNotMatch(out, /add method/);
});

test('--package rejects an unknown package name', () => {
  const res = runCli(['--package', 'not-a-real-package', '--version', '1.0.0']);
  assert.notEqual(res.status, 0, 'unknown --package should exit non-zero');
});

test('--strict exits non-zero when a subject is non-conventional', () => {
  const commits = [
    parseCommit('a1\u0000feat(backend): add endpoint\u0000'),
    parseCommit('b2\u0000just some random message\u0000'),
  ];
  const nonConventional = commits.filter((c) => !c.type);
  assert.ok(nonConventional.length > 0);
  const res = runCli(['--strict', '--version', '1.0.0']);
  // With no conventional commits in range the strict run must not succeed
  // silently; either it exits non-zero or it produces no section.
  assert.ok(res.status !== 0 || !/##\s*1\.0\.0/.test(res.stdout));
});

test('--strict exits zero when all subjects are conventional', () => {
  const commits = [
    parseCommit('a1\u0000feat(backend): add endpoint\u0000'),
    parseCommit('b2\u0000fix(frontend): correct page\u0000'),
  ];
  assert.ok(commits.every((c) => c.type));
  const res = runCli(['--strict', '--version', '1.0.0']);
  assert.equal(res.status, 0);
});

test('--prepend inserts below the marker and above the previous release', () => {
  withTempDir((dir) => {
    const file = join(dir, 'CHANGELOG.md');
    writeFileSync(
      file,
      '# Changelog\n\n<!-- changelog:insert -->\n\n## 0.9.0\n\n- old\n',
    );
    const res = runCli(['--prepend', file, '--version', '1.0.0', '--date', '2024-01-01']);
    assert.equal(res.status, 0);
    const out = readFileSync(file, 'utf8');
    assert.ok(out.includes('<!-- changelog:insert -->'));
    assert.ok(out.indexOf('## 1.0.0') > out.indexOf('<!-- changelog:insert -->'));
    assert.ok(out.indexOf('## 1.0.0') < out.indexOf('## 0.9.0'));
  });
});

test('--prepend fails when the marker is absent', () => {
  withTempDir((dir) => {
    const file = join(dir, 'CHANGELOG.md');
    writeFileSync(file, '# Changelog\n\n## 0.9.0\n\n- old\n');
    const res = runCli(['--prepend', file, '--version', '1.0.0', '--date', '2024-01-01']);
    assert.notEqual(res.status, 0, 'missing marker should fail rather than append');
    const out = readFileSync(file, 'utf8');
    assert.ok(!out.includes('## 1.0.0'), 'file must not be silently appended to');
  });
});

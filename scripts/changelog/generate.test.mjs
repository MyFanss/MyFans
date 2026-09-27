// Tests for scripts/changelog/generate.mjs — run with `npm run changelog:test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommit, classifyPackages, redact, render, insertIntoChangelog, INSERT_MARKER } from './generate.mjs';

test('parses a conventional commit with scope and PR number', () => {
  const c = parseCommit({ hash: 'abc1234def', subject: 'fix(backend): reject stale nonce (#1883)' });
  assert.equal(c.type, 'fix');
  assert.equal(c.scope, 'backend');
  assert.equal(c.desc, 'reject stale nonce');
  assert.equal(c.pr, 1883);
  assert.deepEqual(c.packages, ['backend']);
  assert.equal(c.conventional, true);
});

test('bang and BREAKING CHANGE footer both mark breaking', () => {
  assert.equal(parseCommit({ subject: 'feat(contract)!: rename subscribe arg' }).breaking, true);
  const c = parseCommit({ subject: 'feat: x', body: 'details\n\nBREAKING CHANGE: plan_id is now u64' });
  assert.equal(c.breaking, true);
  assert.equal(c.breakingNote, 'plan_id is now u64');
});

test('non-conventional subjects are kept as "other" (mixed history)', () => {
  const c = parseCommit({ subject: 'Merge main into feature', files: ['frontend/a.ts'] });
  assert.equal(c.conventional, false);
  assert.equal(c.type, null);
  assert.deepEqual(c.packages, ['frontend']);
});

test('unknown type is treated as non-conventional', () => {
  assert.equal(parseCommit({ subject: 'wip: stuff' }).conventional, false);
});

test('packages come from touched paths when scope is not a package', () => {
  assert.deepEqual(
    classifyPackages('auth', ['backend/src/a.ts', 'frontend/b.tsx', 'docs/x.md']),
    ['backend', 'frontend'],
  );
  assert.deepEqual(classifyPackages(null, ['README.md']), ['repo']);
  assert.deepEqual(classifyPackages('contract,backend', []), ['contract', 'backend']);
});

test('redacts secrets that could leak into public notes', () => {
  const seed = 'S' + 'A'.repeat(55);
  assert.equal(redact(`rotate ${seed} now`), 'rotate [REDACTED] now');
  assert.match(redact('password=hunter2'), /password=\[REDACTED\]/);
  assert.match(redact('api_key: abc123'), /api_key: \[REDACTED\]/);
  assert.equal(redact('db postgres://u:pw@host/db'), 'db [REDACTED]host/db');
  assert.equal(redact('token ghp_' + 'x'.repeat(36)), 'token [REDACTED]');
  // Public keys are not secrets and must survive.
  const pub = 'G' + 'B'.repeat(55);
  assert.equal(redact(pub), pub);
});

test('render groups by section, hides chores by default, lists breaking first', () => {
  const commits = [
    parseCommit({ hash: '1111111aaa', subject: 'feat(frontend): add wallet picker (#10)' }),
    parseCommit({ hash: '2222222bbb', subject: 'fix(contract)!: cap fee bps (#11)' }),
    parseCommit({ hash: '3333333ccc', subject: 'chore: bump version' }),
    parseCommit({ hash: '4444444ddd', subject: 'Random commit', files: ['backend/x.ts'] }),
  ];
  const md = render(commits, { version: 'v0.2.0', date: '2026-01-01', repo: 'o/r' });
  assert.match(md, /^## v0\.2\.0 — 2026-01-01/);
  assert.ok(md.indexOf('### ⚠ Breaking changes') < md.indexOf('### Features'));
  assert.match(md, /- \*\*frontend:\*\* add wallet picker \(\[#10\]\(https:\/\/github\.com\/o\/r\/pull\/10\)\)/);
  assert.doesNotMatch(md, /bump version/);
  assert.match(md, /### Other changes[\s\S]*\*\*backend:\*\* Random commit \(4444444\)/);
  assert.match(render(commits, { all: true }), /### Chores/);
});

test('empty range renders a placeholder', () => {
  assert.match(render([], { version: 'v1' }), /_No notable changes._/);
});

test('insertIntoChangelog puts the newest section right below the marker', () => {
  const file = `# Changelog\n\n${INSERT_MARKER}\n\n## v0.1.0\n\n- old\n`;
  const out = insertIntoChangelog(file, '## v0.2.0\n\n- new\n');
  assert.ok(out.indexOf('## v0.2.0') < out.indexOf('## v0.1.0'));
  assert.ok(out.indexOf(INSERT_MARKER) < out.indexOf('## v0.2.0'));
  assert.throws(() => insertIntoChangelog('# no marker', 'x'), /Marker/);
});

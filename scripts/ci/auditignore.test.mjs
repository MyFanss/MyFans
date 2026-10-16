import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseAuditIgnore, loadAuditIgnore } from './auditignore.mjs';

const TODAY = new Date('2026-01-01');

function parse(text) {
  return parseAuditIgnore(text, { today: TODAY });
}

test('parses a valid entry into { id, reason, issue, expires, line }', () => {
  const { entries, errors } = parse(
    'GHSA-aaaa-bbbb-cccc: some reason https://github.com/org/repo/issues/1\n',
  );
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    id: 'GHSA-AAAA-BBBB-CCCC',
    reason: 'some reason',
    issue: 'https://github.com/org/repo/issues/1',
    expires: null,
    line: 1,
  });
});

test('ignores comment-only and blank lines', () => {
  const { entries, errors } = parse(
    '\n# a comment\n   \n# another comment\n',
  );
  assert.deepEqual(entries, []);
  assert.deepEqual(errors, []);
});

test('errors on a line without a colon', () => {
  const { entries, errors } = parse('GHSA-aaaa-bbbb-cccc no colon here\n');
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line 1/);
});

test('errors on an unknown advisory id prefix', () => {
  const { entries, errors } = parse(
    'CVE-2024-0001: reason https://github.com/org/repo/issues/2\n',
  );
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line 1/);
  assert.match(errors[0], /CVE-2024-0001/);
});

test('errors on an entry without a GitHub issue URL', () => {
  const { entries, errors } = parse('GHSA-aaaa-bbbb-cccc: reason without a link\n');
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line 1/);
  assert.match(errors[0], /GHSA-AAAA-BBBB-CCCC/);
});

test('errors on a duplicate id', () => {
  const { entries, errors } = parse(
    'GHSA-aaaa-bbbb-cccc: first https://github.com/org/repo/issues/3\n' +
      'GHSA-AAAA-BBBB-CCCC: second https://github.com/org/repo/issues/4\n',
  );
  assert.equal(entries.length, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line 2/);
  assert.match(errors[0], /GHSA-AAAA-BBBB-CCCC/);
});

test('errors on an entry whose expires date is before today', () => {
  const { entries, errors } = parse(
    'GHSA-aaaa-bbbb-cccc: reason https://github.com/org/repo/issues/5 expires 2025-12-31\n',
  );
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /line 1/);
  assert.match(errors[0], /GHSA-AAAA-BBBB-CCCC/);
});

test('accepts a valid entry with a future expires date', () => {
  const { entries, errors } = parse(
    'GHSA-aaaa-bbbb-cccc: reason https://github.com/org/repo/issues/6 expires 2026-06-01\n',
  );
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].expires, '2026-06-01');
});

test('loadAuditIgnore returns empty entries and errors for a nonexistent path', () => {
  const result = loadAuditIgnore('scripts/ci/__no_such__.auditignore');
  assert.deepEqual(result, { entries: [], errors: [] });
});

// Parser for the per-package `.auditignore` files (Issue #1847).
//
// Format — one exception per line, `#` starts a comment:
//
//   <ADVISORY-ID>: <reason> <tracking issue URL> [expires YYYY-MM-DD]
//
// ADVISORY-ID is a GHSA id (GHSA-xxxx-xxxx-xxxx), a RustSec id
// (RUSTSEC-YYYY-NNNN), or a legacy npm advisory id (NPM-1234). Every entry
// MUST link a GitHub issue so audit noise is never silenced without a
// tracked owner. Entries past their expiry date are rejected.

import { readFileSync, existsSync } from 'node:fs';

const ID_RE = /^(GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|RUSTSEC-\d{4}-\d{4}|NPM-\d+)$/i;
const ISSUE_RE = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/;
const EXPIRES_RE = /\bexpires\s+(\d{4}-\d{2}-\d{2})\b/i;

/**
 * @param {string} text
 * @param {{ today?: Date }} [opts]
 * @returns {{ entries: Array<{ id: string, reason: string, issue: string, expires: string | null, line: number }>, errors: string[] }}
 */
export function parseAuditIgnore(text, opts = {}) {
  const today = (opts.today ?? new Date()).toISOString().slice(0, 10);
  const entries = [];
  const errors = [];

  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1;
    const content = raw.replace(/#.*$/, '').trim();
    if (!content) return;

    const sep = content.indexOf(':');
    if (sep === -1) {
      errors.push(`line ${line}: expected "<ADVISORY-ID>: <reason> <issue URL>"`);
      return;
    }

    const id = content.slice(0, sep).trim().toUpperCase();
    const reason = content.slice(sep + 1).trim();

    if (!ID_RE.test(id)) {
      errors.push(`line ${line}: "${id}" is not a GHSA, RUSTSEC or NPM advisory id`);
      return;
    }

    const issue = reason.match(ISSUE_RE)?.[0];
    if (!issue) {
      errors.push(`line ${line}: ${id} has no tracking issue link (https://github.com/<owner>/<repo>/issues/<n>)`);
      return;
    }

    const expires = reason.match(EXPIRES_RE)?.[1] ?? null;
    if (expires && expires < today) {
      errors.push(`line ${line}: ${id} exception expired on ${expires}`);
      return;
    }

    if (entries.some((e) => e.id === id)) {
      errors.push(`line ${line}: duplicate exception for ${id}`);
      return;
    }

    entries.push({ id, reason, issue, expires, line });
  });

  return { entries, errors };
}

/** Reads and parses an `.auditignore` file; a missing file means no exceptions. */
export function loadAuditIgnore(path, opts) {
  if (!existsSync(path)) return { entries: [], errors: [] };
  return parseAuditIgnore(readFileSync(path, 'utf8'), opts);
}

/** Emits a GitHub Actions annotation when running in Actions, plain text otherwise. */
export function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::${level}::${message.replace(/\r?\n/g, '%0A')}`);
  } else {
    const stream = level === 'error' ? console.error : console.log;
    stream(`${level.toUpperCase()}: ${message}`);
  }
}

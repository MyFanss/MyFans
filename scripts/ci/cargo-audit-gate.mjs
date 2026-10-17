#!/usr/bin/env node
// cargo audit gate (Issue #1847).
//
// Runs `cargo audit --json` and fails on every RustSec *vulnerability* that is
// not listed in the crate's `.auditignore` with a tracking issue. Many RustSec
// advisories carry no CVSS score, so rather than guess a severity the gate
// blocks on all of them. Informational warnings (unmaintained, unsound,
// yanked) are reported as annotations but do not fail the job.
//
// Fails closed if cargo audit cannot produce a report.
//
// Usage (from the Cargo workspace directory):
//   node ../scripts/ci/cargo-audit-gate.mjs [--ignore-file=.auditignore]
//   node ../scripts/ci/cargo-audit-gate.mjs --input=audit.json

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { annotate, loadAuditIgnore } from './auditignore.mjs';

/**
 * @param {any} report parsed `cargo audit --json` output
 * @param {Array<{ id: string }>} ignores
 */
export function evaluateCargoAudit(report, ignores) {
  if (!report || typeof report !== 'object' || !report.vulnerabilities) {
    throw new Error('cargo audit report has no "vulnerabilities" section');
  }

  const ignoreIds = new Set(ignores.map((e) => e.id));
  const blocking = [];
  const ignored = [];
  const seen = new Set();

  for (const item of report.vulnerabilities.list ?? []) {
    const id = String(item.advisory?.id ?? '').toUpperCase();
    seen.add(id);
    const finding = {
      id,
      title: item.advisory?.title ?? '',
      package: `${item.package?.name ?? '?'}@${item.package?.version ?? '?'}`,
    };
    (ignoreIds.has(id) ? ignored : blocking).push(finding);
  }

  const warnings = [];
  for (const [kind, list] of Object.entries(report.warnings ?? {})) {
    for (const w of list ?? []) {
      const id = w.advisory?.id ? String(w.advisory.id).toUpperCase() : null;
      if (id) seen.add(id);
      warnings.push({ kind, id, package: `${w.package?.name ?? '?'}@${w.package?.version ?? '?'}` });
    }
  }

  const staleIgnores = ignores.filter((e) => !seen.has(e.id));
  return { blocking, ignored, warnings, staleIgnores };
}

function parseArgs(argv) {
  const args = { ignoreFile: '.auditignore', input: null };
  for (const arg of argv) {
    const [key, value] = arg.split('=', 2);
    if (key === '--ignore-file') args.ignoreFile = value;
    else if (key === '--input') args.input = value;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function runCargoAudit() {
  const res = spawnSync('cargo', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`cargo audit did not return JSON (exit ${res.status}): ${res.stderr.trim().slice(0, 500)}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const { entries, errors } = loadAuditIgnore(args.ignoreFile);
  if (errors.length) {
    for (const e of errors) annotate('error', `${args.ignoreFile}: ${e}`);
    process.exit(1);
  }

  const report = args.input ? JSON.parse(readFileSync(args.input, 'utf8')) : runCargoAudit();
  const result = evaluateCargoAudit(report, entries);

  for (const w of result.warnings) {
    annotate('warning', `${w.kind}: ${w.id ?? '(no advisory)'} ${w.package} (informational, not gated)`);
  }
  for (const f of result.ignored) {
    const entry = entries.find((e) => e.id === f.id);
    annotate('warning', `${f.id} ${f.package} ignored via ${args.ignoreFile} — tracked in ${entry.issue}`);
  }
  for (const stale of result.staleIgnores) {
    annotate('warning', `${args.ignoreFile}: ${stale.id} no longer reported by cargo audit; remove the exception`);
  }
  for (const f of result.blocking) {
    annotate('error', `${f.id} ${f.package}: ${f.title}`);
  }

  console.log(
    `cargo audit gate: ${result.blocking.length} blocking, ${result.ignored.length} ignored, ` +
      `${result.warnings.length} informational warnings`,
  );
  if (result.blocking.length) {
    console.log(`Upgrade the affected crates, or add a ${args.ignoreFile} entry that links a tracking issue.`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    annotate('error', err.message);
    process.exit(1);
  }
}

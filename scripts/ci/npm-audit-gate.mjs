#!/usr/bin/env node
// npm audit gate (Issue #1847).
//
// Equivalent to `npm audit --audit-level=high` but honours the package's
// `.auditignore` exceptions, each of which must link a tracking issue.
// Fails closed: if npm audit itself errors (no lockfile, registry outage),
// the gate fails rather than passing silently.
//
// Usage (from a package directory):
//   node ../scripts/ci/npm-audit-gate.mjs [--audit-level=high] [--omit=dev] [--ignore-file=.auditignore]
//   node ../scripts/ci/npm-audit-gate.mjs --input=audit.json   # evaluate a saved report

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { annotate, loadAuditIgnore } from './auditignore.mjs';

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function advisoryId(via) {
  const ghsa = typeof via.url === 'string' ? via.url.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i)?.[0] : undefined;
  return ghsa ? ghsa.toUpperCase() : `NPM-${via.source}`;
}

/**
 * @param {any} report   parsed `npm audit --json` output (auditReportVersion 2)
 * @param {Array<{ id: string }>} ignores
 * @param {string} level minimum severity that blocks
 */
export function evaluateNpmAudit(report, ignores, level = 'high') {
  if (!report || typeof report !== 'object') {
    throw new Error('npm audit produced no JSON report');
  }
  if (report.error) {
    throw new Error(`npm audit failed: ${report.error.summary ?? report.error.code ?? 'unknown error'}`);
  }
  if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    throw new Error('npm audit report has no "vulnerabilities" section (unsupported npm version?)');
  }

  const threshold = SEVERITY_RANK[level];
  if (threshold === undefined) throw new Error(`unknown audit level "${level}"`);

  const ignoreIds = new Set(ignores.map((e) => e.id));
  /** @type {Map<string, { id: string, severity: string, title: string, packages: Set<string> }>} */
  const advisories = new Map();

  for (const [pkg, vuln] of Object.entries(report.vulnerabilities)) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || via === null) continue; // transitive pointer
      const id = advisoryId(via);
      const existing = advisories.get(id);
      if (existing) {
        existing.packages.add(pkg);
      } else {
        advisories.set(id, {
          id,
          severity: via.severity ?? vuln.severity,
          title: via.title ?? '',
          packages: new Set([pkg]),
        });
      }
    }
  }

  const blocking = [];
  const ignored = [];
  let belowThreshold = 0;
  for (const adv of advisories.values()) {
    if ((SEVERITY_RANK[adv.severity] ?? SEVERITY_RANK.critical) < threshold) {
      belowThreshold += 1;
    } else if (ignoreIds.has(adv.id)) {
      ignored.push(adv);
    } else {
      blocking.push(adv);
    }
  }

  const seen = new Set(advisories.keys());
  const staleIgnores = ignores.filter((e) => !seen.has(e.id));

  return { blocking, ignored, staleIgnores, belowThreshold };
}

function parseArgs(argv) {
  const args = { level: 'high', omit: [], ignoreFile: '.auditignore', input: null };
  for (const arg of argv) {
    const [key, value] = arg.split('=', 2);
    if (key === '--audit-level') args.level = value;
    else if (key === '--omit') args.omit.push(value);
    else if (key === '--ignore-file') args.ignoreFile = value;
    else if (key === '--input') args.input = value;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function runNpmAudit(omit) {
  const res = spawnSync('npm', ['audit', '--json', ...omit.map((o) => `--omit=${o}`)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`npm audit did not return JSON (exit ${res.status}): ${res.stderr.trim().slice(0, 500)}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const { entries, errors } = loadAuditIgnore(args.ignoreFile);
  if (errors.length) {
    for (const e of errors) annotate('error', `${args.ignoreFile}: ${e}`);
    process.exit(1);
  }

  const report = args.input ? JSON.parse(readFileSync(args.input, 'utf8')) : runNpmAudit(args.omit);
  const result = evaluateNpmAudit(report, entries, args.level);

  for (const adv of result.ignored) {
    const entry = entries.find((e) => e.id === adv.id);
    annotate('warning', `${adv.id} (${adv.severity}) ignored via ${args.ignoreFile} — tracked in ${entry.issue}`);
  }
  for (const stale of result.staleIgnores) {
    annotate('warning', `${args.ignoreFile}: ${stale.id} no longer reported by npm audit; remove the exception`);
  }
  for (const adv of result.blocking) {
    annotate(
      'error',
      `${adv.id} (${adv.severity}) ${adv.title} — packages: ${[...adv.packages].join(', ')}`,
    );
  }

  console.log(
    `npm audit gate (level=${args.level}): ${result.blocking.length} blocking, ` +
      `${result.ignored.length} ignored, ${result.belowThreshold} below threshold`,
  );
  if (result.blocking.length) {
    console.log(`Fix the advisories above, or add a ${args.ignoreFile} entry that links a tracking issue.`);
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

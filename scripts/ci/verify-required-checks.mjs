#!/usr/bin/env node
// Required status check alignment (Issue #1847).
//
// Branch protection that names a check no job produces is theater: the PR
// either waits forever or, worse, someone removes the rule to unblock it.
// This script keeps three things in lock-step:
//
//   .github/required-checks.json  (source of truth)
//   job `name:` values in .github/workflows/*.yml
//   docs/BRANCH_PROTECTION.md
//
// and, with --remote, the live rulesets / classic branch protection on GitHub.
//
// Local checks (default, run in CI):
//   - each required job exists in its workflow and its `name:` equals the context
//   - the workflow is structurally valid (top-level name/on/jobs)
//   - the workflow runs on pull_request for the target branch, with no
//     paths/paths-ignore filter (a required check that never runs blocks PRs)
//   - the job has no `continue-on-error` (job or step) and no job-level `if:`
//     (a skipped job reports success, so both let a required check pass silently)
//   - no other job in any workflow reports the same name (ambiguous context)
//   - every context appears verbatim in docs/BRANCH_PROTECTION.md
//
// Remote check (--remote [--repo=owner/name]): uses `gh api` to read the rules
// that apply to each target branch and reports contexts that are required on
// GitHub but missing from the config, and vice versa.
//
// Exit codes: 0 aligned, 1 misaligned, 2 usage / environment error.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function unquote(value) {
  const v = value.replace(/\s+#.*$/, '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

/**
 * Minimal, structure-aware reader for GitHub workflow files. It only extracts
 * what the alignment rules need, from the two-space-indented layout used in
 * this repo, so it has no dependency on a YAML library.
 */
export function parseWorkflow(text) {
  const lines = text.split(/\r?\n/);
  const topLevel = new Map(); // key -> [start, end) line range of its block
  let current = null;
  lines.forEach((line, i) => {
    const m = line.match(/^([A-Za-z_"'][\w"'-]*):(.*)$/);
    if (m) {
      if (current) topLevel.get(current)[1] = i;
      current = unquote(m[1]);
      topLevel.set(current, [i, lines.length]);
    }
  });

  const block = (key) => {
    const range = topLevel.get(key);
    return range ? lines.slice(range[0] + 1, range[1]) : [];
  };

  // ── on: ──
  const onInline = topLevel.has('on') ? lines[topLevel.get('on')[0]].replace(/^on:/, '').trim() : '';
  const onLines = block('on');
  const triggers = new Map(); // event -> { branches: string[] | null, paths: boolean }
  if (onInline) {
    for (const ev of onInline.replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean)) {
      triggers.set(ev, { branches: null, paths: false });
    }
  }
  let ev = null;
  for (let i = 0; i < onLines.length; i++) {
    const line = onLines[i];
    const evMatch = line.match(/^ {2}([\w-]+):/);
    if (evMatch) {
      ev = evMatch[1];
      triggers.set(ev, { branches: null, paths: false });
      continue;
    }
    if (!ev) continue;
    const prop = line.match(/^ {4}([\w-]+):\s*(.*)$/);
    if (!prop) continue;
    if (prop[1] === 'paths' || prop[1] === 'paths-ignore') triggers.get(ev).paths = true;
    if (prop[1] === 'branches') {
      const inline = prop[2].replace(/\s+#.*$/, '').trim();
      const branches = [];
      if (inline.startsWith('[')) {
        branches.push(...inline.replace(/[[\]]/g, '').split(',').map(unquote).filter(Boolean));
      } else {
        for (let j = i + 1; j < onLines.length && /^ {6}- /.test(onLines[j]); j++) {
          branches.push(unquote(onLines[j].replace(/^ {6}- /, '')));
        }
      }
      triggers.get(ev).branches = branches;
    }
  }

  // ── jobs: ──
  const jobs = new Map();
  let job = null;
  for (const line of block('jobs')) {
    const idMatch = line.match(/^ {2}([\w-]+):\s*(#.*)?$/);
    if (idMatch) {
      job = { id: idMatch[1], name: null, if: false, continueOnError: false };
      jobs.set(job.id, job);
      continue;
    }
    if (!job) continue;
    const prop = line.match(/^ {4}([\w-]+):\s*(.*)$/);
    if (prop?.[1] === 'name') job.name = unquote(prop[2]);
    if (prop?.[1] === 'if') job.if = true;
    const coe = line.match(/^\s+(?:- )?continue-on-error:\s*(.*)$/);
    if (coe && !/^false\b/.test(unquote(coe[1]))) job.continueOnError = true;
  }

  return { topLevelKeys: [...topLevel.keys()], name: unquote(lines[topLevel.get('name')?.[0]]?.replace(/^name:/, '') ?? ''), triggers, jobs };
}

/** Glob-ish branch filter match used by GitHub (`*` within a segment, `**` across). */
export function branchMatches(pattern, branch) {
  const re = pattern
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${re}$`).test(branch);
}

function coversTarget(branches, target) {
  if (branches === null) return true; // no filter → all branches
  // Pattern targets (release/**) must be listed literally; exact targets may match a pattern.
  return branches.some((b) => b === target || (!target.includes('*') && branchMatches(b, target)));
}

/**
 * @param {{ rulesets: Array<{ target: string, checks: Array<{ context: string, workflow: string, job: string }> }> }} config
 * @param {Map<string, ReturnType<typeof parseWorkflow>>} workflows keyed by repo-relative path
 * @param {string} docs contents of docs/BRANCH_PROTECTION.md
 */
export function verifyLocal(config, workflows, docs) {
  const errors = [];

  // Every job name across all workflows, to detect ambiguous contexts.
  const nameOwners = new Map();
  for (const [path, wf] of workflows) {
    for (const job of wf.jobs.values()) {
      const name = job.name ?? job.id;
      nameOwners.set(name, [...(nameOwners.get(name) ?? []), `${path}#${job.id}`]);
    }
  }

  for (const [path, wf] of workflows) {
    for (const key of ['name', 'on', 'jobs']) {
      if (!wf.topLevelKeys.includes(key)) errors.push(`${path}: missing top-level "${key}:" (workflow will not run)`);
    }
  }

  for (const ruleset of config.rulesets ?? []) {
    const seen = new Set();
    for (const check of ruleset.checks ?? []) {
      const where = `[${ruleset.target}] "${check.context}"`;
      if (seen.has(check.context)) errors.push(`${where}: listed twice`);
      seen.add(check.context);

      const wf = workflows.get(check.workflow);
      if (!wf) {
        errors.push(`${where}: workflow ${check.workflow} not found`);
        continue;
      }
      const job = wf.jobs.get(check.job);
      if (!job) {
        errors.push(`${where}: job "${check.job}" not found in ${check.workflow}`);
        continue;
      }
      if (job.name !== check.context) {
        errors.push(`${where}: ${check.workflow}#${check.job} is named "${job.name ?? check.job}"`);
      }
      if (job.continueOnError) errors.push(`${where}: ${check.workflow}#${check.job} uses continue-on-error`);
      if (job.if) errors.push(`${where}: ${check.workflow}#${check.job} has a job-level "if:" (skipped counts as passing)`);

      const pr = wf.triggers.get('pull_request');
      if (!pr) {
        errors.push(`${where}: ${check.workflow} does not run on pull_request`);
      } else {
        if (pr.paths) errors.push(`${where}: ${check.workflow} pull_request has a paths filter (check may never report)`);
        if (!coversTarget(pr.branches, ruleset.target)) {
          errors.push(`${where}: ${check.workflow} pull_request branches do not include "${ruleset.target}"`);
        }
      }

      const owners = nameOwners.get(check.context) ?? [];
      if (owners.length > 1) errors.push(`${where}: context is ambiguous, produced by ${owners.join(', ')}`);

      if (!docs.includes(`\`${check.context}\``)) {
        errors.push(`${where}: not documented in docs/BRANCH_PROTECTION.md`);
      }
    }
  }
  return errors;
}

/** Compares configured contexts with those GitHub reports as required. */
export function diffRemote(configured, remote) {
  const missing = configured.filter((c) => !remote.includes(c));
  const extra = remote.filter((c) => !configured.includes(c));
  return { missing, extra };
}

function gh(args) {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function remoteContexts(repo, target) {
  // For pattern targets, evaluate the rules for a representative branch name.
  const branch = target.includes('*') ? target.replace(/\*\*?/g, 'verify-required-checks') : target;
  const contexts = new Set();

  const rules = JSON.parse(gh([`repos/${repo}/rules/branches/${encodeURIComponent(branch)}`]));
  for (const rule of rules) {
    if (rule.type !== 'required_status_checks') continue;
    for (const c of rule.parameters?.required_status_checks ?? []) contexts.add(c.context);
  }

  // Classic branch protection (needs admin read; absent → 404).
  if (!target.includes('*')) {
    try {
      const classic = JSON.parse(gh([`repos/${repo}/branches/${encodeURIComponent(branch)}/protection/required_status_checks`]));
      for (const c of classic.checks ?? []) contexts.add(c.context);
      for (const c of classic.contexts ?? []) contexts.add(c);
    } catch (err) {
      const msg = String(err.stderr ?? err.message);
      if (!/404|Branch not protected|Not Found/i.test(msg)) {
        console.log(`note: classic protection for ${branch} not readable (${msg.trim().split('\n')[0]})`);
      }
    }
  }
  return [...contexts];
}

function loadWorkflows() {
  const dir = join(ROOT, '.github', 'workflows');
  const map = new Map();
  for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    map.set(`.github/workflows/${file}`, parseWorkflow(readFileSync(join(dir, file), 'utf8')));
  }
  return map;
}

function main() {
  const args = process.argv.slice(2);
  const remote = args.includes('--remote');
  const repoArg = args.find((a) => a.startsWith('--repo='))?.split('=')[1];
  const unknown = args.filter((a) => a !== '--remote' && !a.startsWith('--repo='));
  if (unknown.length) {
    console.error(`unknown argument(s): ${unknown.join(' ')}`);
    return 2;
  }

  const config = JSON.parse(readFileSync(join(ROOT, '.github', 'required-checks.json'), 'utf8'));
  const docsPath = join(ROOT, 'docs', 'BRANCH_PROTECTION.md');
  const docs = existsSync(docsPath) ? readFileSync(docsPath, 'utf8') : '';

  const errors = verifyLocal(config, loadWorkflows(), docs);

  if (remote) {
    let repo = repoArg ?? process.env.GITHUB_REPOSITORY;
    try {
      repo ??= execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim();
    } catch {
      console.error('cannot determine repository; pass --repo=owner/name');
      return 2;
    }
    for (const ruleset of config.rulesets) {
      let live;
      try {
        live = remoteContexts(repo, ruleset.target);
      } catch (err) {
        console.error(`gh api failed for ${repo} (${ruleset.target}): ${String(err.stderr ?? err.message).trim()}`);
        return 2;
      }
      const { missing, extra } = diffRemote(ruleset.checks.map((c) => c.context), live);
      for (const c of missing) errors.push(`[${ruleset.target}] "${c}" is configured but NOT required on GitHub`);
      for (const c of extra) errors.push(`[${ruleset.target}] "${c}" is required on GitHub but not in .github/required-checks.json`);
      console.log(`${repo} ${ruleset.target}: ${live.length} required on GitHub, ${ruleset.checks.length} configured`);
    }
  }

  const total = config.rulesets.reduce((n, r) => n + r.checks.length, 0);
  if (errors.length) {
    for (const e of errors) {
      console.log(process.env.GITHUB_ACTIONS === 'true' ? `::error::${e}` : `✗ ${e}`);
    }
    console.log(`\n${errors.length} problem(s). Update .github/required-checks.json, the workflow, and docs/BRANCH_PROTECTION.md together.`);
    return 1;
  }
  console.log(`✓ ${total} required check(s) across ${config.rulesets.length} ruleset(s) are aligned${remote ? ' with GitHub' : ''}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

#!/usr/bin/env node
// MyFans — release notes / changelog generator from Conventional Commits (issue #1857).
//
// Zero dependencies. Reads `git log`, groups commits by type, tags each entry
// with the monorepo package(s) it touched, surfaces breaking changes, and
// redacts anything that looks like a secret before printing.
//
// Usage:
//   node scripts/changelog/generate.mjs [options]
//
// Options:
//   --from <ref>        Start (exclusive). Default: previous tag for --tag-prefix, else full history
//   --to <ref>          End (inclusive). Default: HEAD
//   --version <label>   Heading label. Default: "Unreleased"
//   --date <yyyy-mm-dd> Heading date. Default: today (UTC)
//   --package <name>    Only include commits touching contract | backend | frontend
//   --tag-prefix <p>    Tag prefix used to find --from (default: "v"; e.g. "contract-v")
//   --repo <owner/name> For PR/commit links. Default: $GITHUB_REPOSITORY or MyFanss/MyFans
//   --all               Also include chore/style commits (hidden by default)
//   --strict            Exit 1 if any commit in range is not a Conventional Commit
//   --out <file>        Write to file instead of stdout
//   --prepend <file>    Insert notes below the `<!-- changelog:insert -->` marker in <file>
//   -h, --help

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PACKAGES = ['contract', 'backend', 'frontend'];

// Order = order of sections in the output.
export const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Bug Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['revert', 'Reverts'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['build', 'Build & Dependencies'],
  ['ci', 'CI'],
  ['chore', 'Chores'],
  ['style', 'Style'],
];
const HIDDEN_BY_DEFAULT = new Set(['chore', 'style']);
const KNOWN_TYPES = new Set(SECTIONS.map(([t]) => t));

const CONVENTIONAL_RE = /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?:\s+(?<desc>.+)$/;
const PR_RE = /\s*\(#(\d+)\)\s*$/;

/** Parse one commit subject/body into a structured record. */
export function parseCommit({ hash = '', subject = '', body = '', files = [] }) {
  const m = CONVENTIONAL_RE.exec(subject.trim());
  let type = null;
  let scope = null;
  let desc = subject.trim();
  let breaking = false;
  if (m && KNOWN_TYPES.has(m.groups.type.toLowerCase())) {
    type = m.groups.type.toLowerCase();
    scope = m.groups.scope?.trim() || null;
    desc = m.groups.desc.trim();
    breaking = Boolean(m.groups.bang);
  }
  const breakingNote = /^BREAKING[ -]CHANGE:\s*(.+)$/m.exec(body);
  if (breakingNote) breaking = true;

  let pr = null;
  const prMatch = PR_RE.exec(desc);
  if (prMatch) {
    pr = Number(prMatch[1]);
    desc = desc.replace(PR_RE, '');
  }

  return {
    hash,
    type,
    scope,
    desc,
    pr,
    breaking,
    breakingNote: breakingNote ? breakingNote[1].trim() : null,
    conventional: type !== null,
    packages: classifyPackages(scope, files),
  };
}

/** Packages a commit belongs to: explicit scope wins, else touched paths. */
export function classifyPackages(scope, files) {
  if (scope) {
    const fromScope = scope
      .split(/[,/]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => PACKAGES.includes(s));
    if (fromScope.length) return fromScope;
  }
  const found = new Set();
  for (const f of files) {
    const top = f.split('/')[0];
    if (PACKAGES.includes(top)) found.add(top);
  }
  return found.size ? PACKAGES.filter((p) => found.has(p)) : ['repo'];
}

// Anything that looks like a credential is replaced before it can reach
// release notes. Commit messages should never contain these, but release
// notes are public and permanent, so we scrub defensively.
const SECRET_PATTERNS = [
  /\bS[A-Z2-7]{55}\b/g, // Stellar secret seed
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, // JWT
  /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g, // GitHub tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\b(?:postgres(?:ql)?|redis|mysql):\/\/[^\s:@/]+:[^\s@/]+@/gi, // URLs with inline credentials
  /\b((?:secret|password|passwd|token|api[_-]?key|private[_-]?key)\s*[:=]\s*)\S+/gi,
];

export const INSERT_MARKER = '<!-- changelog:insert -->';

/** Insert a rendered release section directly below the marker line. */
export function insertIntoChangelog(existing, section) {
  const idx = existing.indexOf(INSERT_MARKER);
  if (idx === -1) throw new Error(`Marker ${INSERT_MARKER} not found`);
  const end = idx + INSERT_MARKER.length;
  return `${existing.slice(0, end)}\n\n${section.trimEnd()}\n${existing.slice(end)}`;
}

export function redact(text) {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (match, prefix) =>
      typeof prefix === 'string' && match.startsWith(prefix) ? `${prefix}[REDACTED]` : '[REDACTED]',
    );
  }
  return out;
}

function entryLine(c, repo) {
  const pkgs = c.packages.filter((p) => p !== 'repo');
  const tag = pkgs.length ? `**${pkgs.join(', ')}:** ` : '';
  const scope = c.scope && !PACKAGES.includes(c.scope.toLowerCase()) ? `_${c.scope}_ — ` : '';
  const ref = c.pr
    ? ` ([#${c.pr}](https://github.com/${repo}/pull/${c.pr}))`
    : c.hash
      ? ` (${c.hash.slice(0, 7)})`
      : '';
  return `- ${tag}${scope}${redact(c.desc)}${ref}`;
}

/** Render parsed commits to Markdown. */
export function render(commits, { version = 'Unreleased', date = '', repo = 'MyFanss/MyFans', all = false } = {}) {
  const lines = [`## ${version}${date ? ` — ${date}` : ''}`, ''];

  const breaking = commits.filter((c) => c.breaking);
  if (breaking.length) {
    lines.push('### ⚠ Breaking changes', '');
    for (const c of breaking) {
      lines.push(entryLine(c, repo));
      if (c.breakingNote) lines.push(`  - ${redact(c.breakingNote)}`);
    }
    lines.push('');
  }

  for (const [type, title] of SECTIONS) {
    if (!all && HIDDEN_BY_DEFAULT.has(type)) continue;
    const group = commits.filter((c) => c.type === type);
    if (!group.length) continue;
    lines.push(`### ${title}`, '');
    for (const c of group) lines.push(entryLine(c, repo));
    lines.push('');
  }

  const other = commits.filter((c) => !c.conventional);
  if (other.length) {
    lines.push('### Other changes', '', '_Commits that do not follow Conventional Commits._', '');
    for (const c of other) lines.push(entryLine(c, repo));
    lines.push('');
  }

  if (lines.length === 2) lines.push('_No notable changes._', '');
  return lines.join('\n');
}

// ── git plumbing ──────────────────────────────────────────────────────────

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function previousTag(prefix, to) {
  try {
    // Search from the parent of `to` so tagging HEAD and generating for that
    // tag compares against the tag before it.
    return git(['describe', '--tags', '--abbrev=0', '--match', `${prefix}*`, `${to}^`]).trim() || null;
  } catch {
    return null;
  }
}

export function readCommits(from, to) {
  const range = from ? `${from}..${to}` : to;
  const raw = git(['log', '--no-merges', '--name-only', '--format=%x1e%H%x1f%s%x1f%b%x1f', range]);
  return raw
    .split('\x1e')
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [hash, subject, body, fileBlock = ''] = chunk.split('\x1f');
      const files = fileBlock.split('\n').map((f) => f.trim()).filter(Boolean);
      return parseCommit({ hash: hash.trim(), subject, body, files });
    });
}

function parseArgs(argv) {
  const opts = { to: 'HEAD', version: 'Unreleased', tagPrefix: 'v', all: false, strict: false };
  const needs = (i) => {
    if (i + 1 >= argv.length) throw new Error(`Missing value for ${argv[i]}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--from': opts.from = needs(i); i++; break;
      case '--to': opts.to = needs(i); i++; break;
      case '--version': opts.version = needs(i); i++; break;
      case '--date': opts.date = needs(i); i++; break;
      case '--package': opts.package = needs(i); i++; break;
      case '--tag-prefix': opts.tagPrefix = needs(i); i++; break;
      case '--repo': opts.repo = needs(i); i++; break;
      case '--out': opts.out = needs(i); i++; break;
      case '--prepend': opts.prepend = needs(i); i++; break;
      case '--all': opts.all = true; break;
      case '--strict': opts.strict = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default: throw new Error(`Unknown option: ${a}`);
    }
  }
  if (opts.package && !PACKAGES.includes(opts.package)) {
    throw new Error(`--package must be one of: ${PACKAGES.join(', ')}`);
  }
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[changelog] ${err.message}`);
    process.exit(1);
  }
  if (opts.help) {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
    console.log(src.slice(1, 25).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }

  const from = opts.from ?? previousTag(opts.tagPrefix, opts.to);
  let commits = readCommits(from, opts.to);
  if (opts.package) commits = commits.filter((c) => c.packages.includes(opts.package));

  const nonConventional = commits.filter((c) => !c.conventional);
  if (opts.strict && nonConventional.length) {
    console.error(`[changelog] ${nonConventional.length} non-conventional commit(s) in range:`);
    for (const c of nonConventional) console.error(`  ${c.hash.slice(0, 7)} ${c.desc}`);
    process.exit(1);
  }

  const md = render(commits, {
    version: opts.version,
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    repo: opts.repo ?? process.env.GITHUB_REPOSITORY ?? 'MyFanss/MyFans',
    all: opts.all,
  });

  console.error(
    `[changelog] range ${from ?? '(root)'}..${opts.to}: ${commits.length} commits, ` +
      `${nonConventional.length} non-conventional${opts.package ? `, package=${opts.package}` : ''}`,
  );
  if (opts.prepend) {
    try {
      writeFileSync(opts.prepend, insertIntoChangelog(readFileSync(opts.prepend, 'utf8'), md));
    } catch (err) {
      console.error(`[changelog] ${opts.prepend}: ${err.message}`);
      process.exit(1);
    }
  }
  if (opts.out) writeFileSync(opts.out, md);
  else if (!opts.prepend) process.stdout.write(md);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

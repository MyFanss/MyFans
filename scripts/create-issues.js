#!/usr/bin/env node
/**
 * Create GitHub issues from ISSUES.md on repo MyFanss/MyFans.
 * Requires: gh CLI installed and authenticated (gh auth login).
 * Usage: node scripts/create-issues.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REPO = 'MyFanss/MyFans';
const ISSUES_PATH = path.join(__dirname, '..', 'ISSUES.md');
const DRY_RUN = process.argv.includes('--dry-run');

function checkGhAuth() {
  if (process.env.GH_TOKEN) return true;
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!DRY_RUN && !checkGhAuth()) {
  console.error('GitHub CLI is not authenticated. Create issues on', REPO, 'with either:\n');
  console.error('  1. Run:  gh auth login');
  console.error('  2. Or set a token:  export GH_TOKEN=your_github_token\n');
  console.error('Then run this script again.');
  process.exit(1);
}

const content = fs.readFileSync(ISSUES_PATH, 'utf8');

// Split by "## N. " to get each issue block
const blocks = content.split(/\n(?=## \d+\. )/).filter((b) => b.trim());

const issues = [];
for (const block of blocks) {
  const match = block.match(/^## (\d+)\. (.+?)(?:\n|$)/);
  if (!match) continue;
  const [, num, title] = match;
  const body = block
    .replace(/^## \d+\. .+?\n/, '')
    .replace(/\n---\s*$/, '')
    .trim();
  issues.push({ num: parseInt(num, 10), title: title.trim(), body });
}

console.log(`Found ${issues.length} issues in ISSUES.md`);
if (DRY_RUN) {
  issues.forEach(({ num, title }) => console.log(`  ${num}. ${title}`));
  process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myfans-issues-'));
let created = 0;
let failed = 0;

try {
  for (const { num, title, body } of issues) {
    const bodyFile = path.join(tmpDir, `issue-${num}.md`);
    fs.writeFileSync(bodyFile, body, 'utf8');
    const titleEsc = title.replace(/"/g, '\\"');
    try {
      execSync(
        `gh issue create --repo ${REPO} --title "${titleEsc}" --body-file "${bodyFile}"`,
        { stdio: 'inherit', shell: true }
      );
      created++;
      console.log(`Created issue ${num}: ${title}`);
    } catch (e) {
      failed++;
      console.error(`Failed to create issue ${num}: ${title}`, e.message);
    }
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\nDone. Created: ${created}, Failed: ${failed}`);


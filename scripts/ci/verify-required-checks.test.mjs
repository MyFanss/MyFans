import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseWorkflow, branchMatches, verifyLocal, diffRemote } from './verify-required-checks.mjs';

const DOCS = 'See `Repo — required checks alignment` and `Frontend — eslint` for details.';

function workflow({ name = 'CI', branches = null, paths = false, jobs = {} } = {}) {
  const lines = [`name: ${name}`, 'on:', '  pull_request:'];
  if (branches) {
    lines.push('    branches:');
    for (const b of branches) lines.push(`      - ${b}`);
  }
  if (paths) {
    lines.push('    paths:');
    lines.push('      - "src/**"');
  }
  lines.push('jobs:');
  for (const [id, job] of Object.entries(jobs)) {
    lines.push(`  ${id}:`);
    if (job.name) lines.push(`    name: ${job.name}`);
    if (job.if) lines.push('    if: github.event_name == \'pull_request\'');
    if (job.continueOnError) lines.push('    continue-on-error: true');
  }
  return parseWorkflow(lines.join('\n'));
}

test('parseWorkflow extracts and unquotes a job name', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches: [main]',
      'jobs:',
      '  lint:',
      '    name: "Frontend — eslint"',
    ].join('\n'),
  );
  assert.equal(wf.jobs.lint.name, 'Frontend — eslint');
});

test('parseWorkflow sets the if flag for a job-level if:', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches: [main]',
      'jobs:',
      '  lint:',
      '    name: Lint',
      "    if: github.event_name == 'pull_request'",
    ].join('\n'),
  );
  assert.equal(wf.jobs.lint.if, true);
});

test('parseWorkflow sets continueOnError for job-level continue-on-error', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches: [main]',
      'jobs:',
      '  lint:',
      '    name: Lint',
      '    continue-on-error: true',
    ].join('\n'),
  );
  assert.equal(wf.jobs.lint.continueOnError, true);
});

test('parseWorkflow sets continueOnError for step-level continue-on-error', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches: [main]',
      'jobs:',
      '  lint:',
      '    name: Lint',
      '    steps:',
      '      - name: Run',
      '        run: echo hi',
      '        continue-on-error: true',
    ].join('\n'),
  );
  assert.equal(wf.jobs.lint.continueOnError, true);
});

test('parseWorkflow sets paths for a paths filter under pull_request', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches: [main]',
      '    paths:',
      '      - "src/**"',
      'jobs:',
      '  lint:',
      '    name: Lint',
    ].join('\n'),
  );
  assert.equal(wf.paths, true);
});

test('parseWorkflow sets paths for a paths-ignore filter under pull_request', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches: [main]',
      '    paths-ignore:',
      '      - "docs/**"',
      'jobs:',
      '  lint:',
      '    name: Lint',
    ].join('\n'),
  );
  assert.equal(wf.paths, true);
});

test('parseWorkflow handles inline on: [pull_request]', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on: [pull_request]',
      'jobs:',
      '  lint:',
      '    name: Lint',
    ].join('\n'),
  );
  assert.ok(wf.triggers.has('pull_request'));
});

test('parseWorkflow handles block on: with a branches list', () => {
  const wf = parseWorkflow(
    [
      'name: CI',
      'on:',
      '  pull_request:',
      '    branches:',
      '      - main',
      '      - release/**',
      'jobs:',
      '  lint:',
      '    name: Lint',
    ].join('\n'),
  );
  assert.ok(wf.triggers.has('pull_request'));
  assert.deepEqual(wf.triggers.get('pull_request').branches, ['main', 'release/**']);
});

test('branchMatches supports exact, wildcard, and double-wildcard patterns', () => {
  assert.equal(branchMatches('main', 'main'), true);
  assert.equal(branchMatches('main', 'dev'), false);
  assert.equal(branchMatches('release/*', 'release/1.0'), true);
  assert.equal(branchMatches('release/*', 'release/1.0/hotfix'), false);
  assert.equal(branchMatches('release/**', 'release/1.0/hotfix'), true);
});

test('verifyLocal passes when config, workflow, and docs are aligned', () => {
  const wf = workflow({
    name: 'ci.yml',
    branches: ['main'],
    jobs: { lint: { name: 'Frontend — eslint' } },
  });
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [{ context: 'Frontend — eslint', workflow: '.github/workflows/ci.yml', job: 'lint' }],
      },
    ],
  };
  const workflows = new Map([['.github/workflows/ci.yml', wf]]);
  const errors = verifyLocal(config, workflows, DOCS);
  assert.deepEqual(errors, []);
});

test('verifyLocal flags a job name mismatch between config and workflow', () => {
  const wf = workflow({
    branches: ['main'],
    jobs: { lint: { name: 'Something Else' } },
  });
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [{ context: 'Frontend — eslint', workflow: '.github/workflows/ci.yml', job: 'lint' }],
      },
    ],
  };
  const workflows = new Map([['.github/workflows/ci.yml', wf]]);
  const errors = verifyLocal(config, workflows, DOCS);
  assert.ok(errors.some((e) => e.includes('is named "Something Else"')));
});

test('verifyLocal flags a missing workflow or job', () => {
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [{ context: 'Missing', workflow: '.github/workflows/missing.yml', job: 'x' }],
      },
    ],
  };
  const errors = verifyLocal(config, new Map(), DOCS);
  assert.ok(errors.some((e) => e.includes('workflow .github/workflows/missing.yml not found')));
});

test('verifyLocal flags continue-on-error and job-level if as unsafe required checks', () => {
  const wf = workflow({
    branches: ['main'],
    jobs: { lint: { name: 'Frontend — eslint', continueOnError: true, if: true } },
  });
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [{ context: 'Frontend — eslint', workflow: '.github/workflows/ci.yml', job: 'lint' }],
      },
    ],
  };
  const workflows = new Map([['.github/workflows/ci.yml', wf]]);
  const errors = verifyLocal(config, workflows, DOCS);
  assert.ok(errors.some((e) => e.includes('continue-on-error')));
  assert.ok(errors.some((e) => e.includes('job-level "if:"')));
});

test('verifyLocal flags a paths filter and a branch filter that excludes the target', () => {
  const wf = workflow({
    branches: ['develop'],
    paths: true,
    jobs: { lint: { name: 'Frontend — eslint' } },
  });
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [{ context: 'Frontend — eslint', workflow: '.github/workflows/ci.yml', job: 'lint' }],
      },
    ],
  };
  const workflows = new Map([['.github/workflows/ci.yml', wf]]);
  const errors = verifyLocal(config, workflows, DOCS);
  assert.ok(errors.some((e) => e.includes('paths filter')));
  assert.ok(errors.some((e) => e.includes('branches do not include "main"')));
});

test('verifyLocal flags an undocumented context and a duplicate context in the same ruleset', () => {
  const wf = workflow({
    branches: ['main'],
    jobs: { lint: { name: 'Undocumented Check' } },
  });
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [
          { context: 'Undocumented Check', workflow: '.github/workflows/ci.yml', job: 'lint' },
          { context: 'Undocumented Check', workflow: '.github/workflows/ci.yml', job: 'lint' },
        ],
      },
    ],
  };
  const workflows = new Map([['.github/workflows/ci.yml', wf]]);
  const errors = verifyLocal(config, workflows, DOCS);
  assert.ok(errors.some((e) => e.includes('not documented in docs/BRANCH_PROTECTION.md')));
  assert.ok(errors.some((e) => e.includes('listed twice')));
});

test('verifyLocal flags an ambiguous context produced by more than one job', () => {
  const wf1 = workflow({ branches: ['main'], jobs: { lint: { name: 'Shared Name' } } });
  const wf2 = workflow({ branches: ['main'], jobs: { other: { name: 'Shared Name' } } });
  const config = {
    rulesets: [
      {
        target: 'main',
        checks: [{ context: 'Shared Name', workflow: '.github/workflows/a.yml', job: 'lint' }],
      },
    ],
  };
  const workflows = new Map([
    ['.github/workflows/a.yml', wf1],
    ['.github/workflows/b.yml', wf2],
  ]);
  const errors = verifyLocal(config, workflows, 'Shared Name is documented as `Shared Name`.');
  assert.ok(errors.some((e) => e.includes('context is ambiguous')));
});

test('diffRemote reports contexts missing from GitHub and extra contexts required on GitHub only', () => {
  const configured = ['A', 'B'];
  const remote = ['B', 'C'];
  const { missing, extra } = diffRemote(configured, remote);
  assert.deepEqual(missing, ['A']);
  assert.deepEqual(extra, ['C']);
});

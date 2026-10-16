import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseSourcePathFromHeading,
  parseDocumentedMethods,
  parseDocumentedErrors,
  parseContractMethods,
  parseContractErrors,
  extractContractImplBlocks,
  checkInterfaceDocsDrift,
  KNOWN_NON_CONTRACT_DOCS,
} from './check-interface-docs-drift.mjs';

test('parseSourcePathFromHeading reads source path from H1', () => {
  const md = '# Subscription (contracts/subscription/src/lib.rs)\n\n## Methods';
  assert.equal(
    parseSourcePathFromHeading(md),
    'contracts/subscription/src/lib.rs',
  );
});

test('parseDocumentedMethods splits grouped rows and strips backticks', () => {
  const md = `
| Method | Args | Returns |
|---|---|---|
| \`init\` | x | y |
| \`pause / unpause\` | x | y |
| \`is_paused\` | x | y |
`;
  const methods = parseDocumentedMethods(md);
  assert.deepEqual(Array.from(methods).sort(), [
    'init',
    'is_paused',
    'pause',
    'unpause',
  ]);
});

test('parseDocumentedMethods collects both names from a pause / unpause row', () => {
  const md = `
## Methods

| Method | Args | Returns |
|---|---|---|
| \`pause / unpause\` | - | - |
`;
  const methods = parseDocumentedMethods(md);
  assert.equal(methods.has('pause'), true);
  assert.equal(methods.has('unpause'), true);
  assert.equal(methods.size, 2);
});

test('parseDocumentedErrors collects each variant from an Error/Variant table', () => {
  const md = `
## Errors

| Error | Variant | Description |
|---|---|---|
| \`NotInitialized\` | \`NotInitialized\` | not initialized |
| \`Unauthorized\` | \`Unauthorized\` | caller not allowed |
| \`Paused\` | \`Paused\` | contract paused |
`;
  const errors = parseDocumentedErrors(md);
  assert.equal(errors.has('NotInitialized'), true);
  assert.equal(errors.has('Unauthorized'), true);
  assert.equal(errors.has('Paused'), true);
  assert.equal(errors.size, 3);
});

test('KNOWN_NON_CONTRACT_DOCS excludes README.md and runbook.md', () => {
  assert.equal(KNOWN_NON_CONTRACT_DOCS.has('README.md'), true);
  assert.equal(KNOWN_NON_CONTRACT_DOCS.has('runbook.md'), true);
});

test('checkInterfaceDocsDrift skips non-contract docs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iface-skip-'));
  const docsDir = path.join(root, 'docs', 'interfaces');
  fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(
    path.join(docsDir, 'README.md'),
    '# Interfaces\n\n| Method |\n|---|\n| \`not_a_real_method\` |\n',
  );
  fs.writeFileSync(
    path.join(docsDir, 'runbook.md'),
    '# Runbook\n\n| Method |\n|---|\n| \`also_not_real\` |\n',
  );

  const result = checkInterfaceDocsDrift(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.failed, []);
});

test('parseContractMethods reads pub fn names', () => {
  const source = `
impl Helper {
  pub fn helper() {}
}

#[contractimpl]
impl Demo {
  pub fn init() {}
  pub fn pause(env: Env) {}
  fn helper() {}
}
`;
  const methods = parseContractMethods(source);
  assert.deepEqual(Array.from(methods).sort(), ['init', 'pause']);
});

test('parseContractMethods only inspects the first contractimpl block', () => {
  const source = `
#[contractimpl]
impl Demo {
  pub fn init() {}
  pub fn pause() {}
}

#[cfg(test)]
#[contractimpl]
impl TestHelper {
  pub fn test_only_helper() {}
}
`;
  const methods = parseContractMethods(source);
  assert.deepEqual(Array.from(methods).sort(), ['init', 'pause']);
  assert.equal(methods.has('test_only_helper'), false);
});

test('parseContractErrors reads error variant names', () => {
  const source = `
#[contracterror]
#[derive(Debug)]
pub enum Error {
  NotInitialized = 1,
  Unauthorized = 2,
}
`;
  const errors = parseContractErrors(source);
  assert.equal(errors.has('NotInitialized'), true);
  assert.equal(errors.has('Unauthorized'), true);
});

test('extractContractImplBlocks returns only contractimpl sections', () => {
  const source = `
impl Helper {
  pub fn helper() {}
}

#[contractimpl]
impl Demo {
  pub fn init() {}
}

#[contractimpl]
impl Second {
  pub fn ping() {}
}
`;
  const blocks = extractContractImplBlocks(source);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].includes('pub fn init() {}'), true);
  assert.equal(blocks[1].includes('pub fn ping() {}'), true);
});

test('checkInterfaceDocsDrift reports stale and undocumented methods', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iface-drift-'));
  const docsDir = path.join(root, 'docs', 'interfaces');
  const srcDir = path.join(root, 'contracts', 'demo', 'src');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  fs.writeFileSync(
    path.join(srcDir, 'lib.rs'),
    `
#[contractimpl]
impl Demo {
pub fn init() {}
pub fn pause() {}
pub fn health() {}
}
`,
  );

  fs.writeFileSync(
    path.join(docsDir, 'demo.md'),
    `# Demo (contracts/demo/src/lib.rs)

## Methods
| Method | Args | Returns |
|---|---|---|
| \`init\` | - | - |
| \`pause / unpause\` | - | - |
`,
  );

  const result = checkInterfaceDocsDrift(root);
  assert.equal(result.ok, false);
  assert.equal(result.failed.length, 1);
  assert.deepEqual(result.failed[0].undocumented, ['health']);
  assert.deepEqual(result.failed[0].staleDocs, ['unpause']);
});

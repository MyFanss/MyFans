import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseSourcePathFromHeading,
  parseDocumentedMethods,
  parseContractMethods,
  extractContractImplBlocks,
  checkInterfaceDocsDrift,
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

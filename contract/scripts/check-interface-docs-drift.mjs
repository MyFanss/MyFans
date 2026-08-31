#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const INTERFACES_DIR = path.join(DEFAULT_ROOT, 'docs', 'interfaces');

const KNOWN_NON_CONTRACT_DOCS = new Set(['README.md', 'runbook.md']);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseSourcePathFromHeading(markdown) {
  const heading = markdown.match(/^# .*\(([^)]+)\)/m);
  if (!heading) return null;
  return heading[1].trim();
}

function parseDocumentedMethods(markdown) {
  const lines = markdown.split(/\r?\n/);
  const methods = new Set();
  let inMethodsTable = false;

  for (const line of lines) {
    if (/^\s*\|\s*Method\s*\|/i.test(line)) {
      inMethodsTable = true;
      continue;
    }

    if (!inMethodsTable) {
      continue;
    }

    if (!line.trim().startsWith('|')) {
      break;
    }

    if (/^\s*\|\s*-+\s*\|/.test(line)) {
      continue;
    }

    const columns = line.split('|');
    if (columns.length < 3) {
      continue;
    }

    const rawMethodCell = columns[1].trim();
    if (!rawMethodCell) {
      continue;
    }

    const unquoted = rawMethodCell.replace(/`/g, '');
    // Support grouped rows such as "pause / unpause"
    const grouped = unquoted.split('/').map((part) => part.trim());
    for (const methodName of grouped) {
      if (!methodName || /\s/.test(methodName)) {
        continue;
      }
      methods.add(methodName);
    }
  }

  return methods;
}

function parseContractMethods(rustSource) {
  const blocks = extractContractImplBlocks(rustSource);
  const methods = new Set();
  if (blocks.length === 0) {
    return methods;
  }

  // Production contract entrypoints are expected in the first #[contractimpl] block.
  // This intentionally ignores test-only helper contracts declared later in #[cfg(test)] modules.
  const targetBlock = blocks[0];
  const regex = /\bpub\s+fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  let match;
  while ((match = regex.exec(targetBlock)) !== null) {
    methods.add(match[1]);
  }
  return methods;
}

function extractContractImplBlocks(rustSource) {
  const blocks = [];
  const marker = '#[contractimpl]';
  let cursor = 0;

  while (cursor < rustSource.length) {
    const markerIdx = rustSource.indexOf(marker, cursor);
    if (markerIdx === -1) {
      break;
    }

    const implIdx = rustSource.indexOf('impl', markerIdx + marker.length);
    if (implIdx === -1) {
      break;
    }

    const braceStart = rustSource.indexOf('{', implIdx);
    if (braceStart === -1) {
      break;
    }

    let depth = 0;
    let end = braceStart;
    for (; end < rustSource.length; end++) {
      const ch = rustSource[end];
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }

    if (depth === 0) {
      blocks.push(rustSource.slice(braceStart, end));
      cursor = end;
    } else {
      break;
    }
  }

  return blocks;
}

function toSortedArray(set) {
  return Array.from(set).sort();
}

function setDiff(left, right) {
  const diff = new Set();
  for (const item of left) {
    if (!right.has(item)) {
      diff.add(item);
    }
  }
  return diff;
}

function collectInterfaceMarkdownFiles(interfacesDir) {
  return fs
    .readdirSync(interfacesDir)
    .filter((entry) => entry.endsWith('.md'))
    .filter((entry) => !KNOWN_NON_CONTRACT_DOCS.has(entry))
    .sort()
    .map((entry) => path.join(interfacesDir, entry));
}

function validateDocFile(rootDir, docPath) {
  const markdown = readText(docPath);
  const headingSourcePath = parseSourcePathFromHeading(markdown);
  if (!headingSourcePath) {
    return {
      ok: false,
      docPath,
      error:
        'Missing source path in H1 heading, expected e.g. "# Name (contracts/.../src/lib.rs)".',
    };
  }

  const sourcePath = path.join(rootDir, headingSourcePath);
  if (!fs.existsSync(sourcePath)) {
    return {
      ok: false,
      docPath,
      sourcePath,
      error: `Referenced source file does not exist: ${headingSourcePath}`,
    };
  }

  const documentedMethods = parseDocumentedMethods(markdown);
  if (documentedMethods.size === 0) {
    return {
      ok: false,
      docPath,
      sourcePath,
      error: 'No methods found in Methods table.',
    };
  }

  const contractMethods = parseContractMethods(readText(sourcePath));
  const undocumented = setDiff(contractMethods, documentedMethods);
  const staleDocs = setDiff(documentedMethods, contractMethods);

  return {
    ok: undocumented.size === 0 && staleDocs.size === 0,
    docPath,
    sourcePath,
    undocumented: toSortedArray(undocumented),
    staleDocs: toSortedArray(staleDocs),
  };
}

export function checkInterfaceDocsDrift(rootDir = DEFAULT_ROOT) {
  const interfacesDir = path.join(rootDir, 'docs', 'interfaces');
  const docFiles = collectInterfaceMarkdownFiles(interfacesDir);

  const results = docFiles.map((docPath) => validateDocFile(rootDir, docPath));
  const failed = results.filter((result) => !result.ok);

  return {
    ok: failed.length === 0,
    checked: results.length,
    results,
    failed,
  };
}

function relativeFromRoot(filePath, rootDir) {
  return path.relative(rootDir, filePath) || filePath;
}

function printFailures(summary, rootDir) {
  for (const result of summary.failed) {
    const label = relativeFromRoot(result.docPath, rootDir);
    console.error(`- ${label}`);
    if (result.error) {
      console.error(`  error: ${result.error}`);
      continue;
    }
    if (result.undocumented?.length) {
      console.error(`  undocumented methods: ${result.undocumented.join(', ')}`);
    }
    if (result.staleDocs?.length) {
      console.error(`  stale docs methods: ${result.staleDocs.join(', ')}`);
    }
  }
}

function runCli() {
  if (!fs.existsSync(INTERFACES_DIR)) {
    console.error(`interfaces dir not found: ${INTERFACES_DIR}`);
    process.exit(1);
  }

  const summary = checkInterfaceDocsDrift(DEFAULT_ROOT);
  if (summary.ok) {
    console.log(
      `Interface docs drift check passed (${summary.checked} files).`,
    );
    return;
  }

  console.error(
    `Interface docs drift check failed (${summary.failed.length}/${summary.checked} files).`,
  );
  printFailures(summary, DEFAULT_ROOT);
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (invokedDirectly) {
  runCli();
}

export {
  parseSourcePathFromHeading,
  parseDocumentedMethods,
  parseContractMethods,
  extractContractImplBlocks,
  collectInterfaceMarkdownFiles,
  validateDocFile,
};

#!/usr/bin/env node
/**
 * CI guard: a production `next build` must not contain any demo / component-story
 * route (`/wallet-demo`, `/error-test`, `/ui`, `/subscribe-example`,
 * `/settings-demo`).
 *
 * Those pages live as `src/app/<route>/page.demo.tsx`. `next.config.ts` only
 * adds the `demo.tsx` page extension when demos are enabled (non-production, or
 * `NEXT_PUBLIC_FLAG_DEMOS=true`), so a plain `next build` should drop them
 * entirely. This script fails the build if that ever regresses.
 *
 * Usage: `node scripts/check-demo-routes.mjs` from the `frontend/` directory,
 * after `next build`. Skips itself (with a warning) when demos are explicitly
 * enabled.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEMO_ROUTES = [
  'wallet-demo',
  'error-test',
  'ui',
  'subscribe-example',
  'settings-demo',
];

const demosEnabled =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_FLAG_DEMOS === 'true';

if (demosEnabled) {
  console.warn(
    '[check-demo-routes] demos are enabled for this build (NODE_ENV !== production or NEXT_PUBLIC_FLAG_DEMOS=true); skipping the prod-exclusion check.',
  );
  process.exit(0);
}

const nextDir = join(process.cwd(), '.next');
if (!existsSync(nextDir)) {
  console.error('[check-demo-routes] .next/ not found — run `next build` first.');
  process.exit(1);
}

const violations = [];

// 1. Compiled server output for the route segment.
for (const route of DEMO_ROUTES) {
  const dir = join(nextDir, 'server', 'app', route);
  if (existsSync(dir)) violations.push(`.next/server/app/${route}/`);
}

// 2. Route manifests that enumerate every built path.
const manifests = [
  'app-path-routes-manifest.json',
  'routes-manifest.json',
  'prerender-manifest.json',
  'app-build-manifest.json',
];
for (const name of manifests) {
  const file = join(nextDir, name);
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, 'utf8');
  for (const route of DEMO_ROUTES) {
    if (raw.includes(`/${route}`)) violations.push(`${name} references /${route}`);
  }
}

// 3. Static HTML fallbacks.
const htmlDir = join(nextDir, 'server', 'app');
if (existsSync(htmlDir)) {
  for (const entry of readdirSync(htmlDir)) {
    const bare = entry.replace(/\.(html|rsc|meta)$/, '');
    if (DEMO_ROUTES.includes(bare)) violations.push(`.next/server/app/${entry}`);
  }
}

if (violations.length > 0) {
  console.error(
    '[check-demo-routes] production build contains demo routes:\n' +
      violations.map((v) => `  - ${v}`).join('\n') +
      '\n\nDemo pages must be named `page.demo.tsx` and must not be reachable in prod.',
  );
  process.exit(1);
}

console.log(
  `[check-demo-routes] OK — no demo routes in the production build (${DEMO_ROUTES.join(', ')}).`,
);

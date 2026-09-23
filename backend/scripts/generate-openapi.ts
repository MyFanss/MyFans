/**
 * Standalone script to generate the OpenAPI JSON spec without starting the server.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/generate-openapi.ts
 * Output: openapi.json in the backend root directory.
 *
 * Also acts as the drift check for issue #1776: every controller path registered
 * in AppModule must either appear in the generated spec or be explicitly listed
 * as internal/excluded below. Run with `--check` to fail (exit 1) on drift.
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Minimal env stubs so the app can bootstrap without real secrets
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'generate-openapi-stub';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_USER = process.env.DB_USER ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
process.env.DB_NAME = process.env.DB_NAME ?? 'myfans';
process.env.SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
process.env.STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? 'testnet';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'generate-openapi-stub';

/**
 * Paths that are intentionally not part of the public OpenAPI contract.
 * - Health/readiness probes are internal infrastructure endpoints.
 * - Webhook receivers are called by third parties, not documented as client API.
 * Any controller path not in the spec must be listed here or the drift check fails.
 */
const INTERNAL_PATH_PREFIXES = ['/health', '/webhooks'];

function isInternalPath(path: string): boolean {
  return INTERNAL_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Enumerate every route path registered by the Nest application by walking the
 * Express router stack. This reflects the actual AppModule controller surface,
 * independent of what Swagger decorators happened to document.
 */
function collectRegisteredPaths(app: { getHttpAdapter: () => { getInstance: () => unknown } }): string[] {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack?: Array<{ route?: { path?: string } }> };
    _router?: { stack?: Array<{ route?: { path?: string } }> };
  };
  const stack = instance.router?.stack ?? instance._router?.stack ?? [];
  const paths = new Set<string>();
  for (const layer of stack) {
    const routePath = layer.route?.path;
    if (typeof routePath === 'string') {
      paths.add(routePath);
    }
  }
  return [...paths].sort();
}

/**
 * Normalize an Express route path (e.g. "/users/:id") to the OpenAPI template
 * form (e.g. "/users/{id}") so the two can be compared.
 */
function toOpenApiPath(routePath: string): string {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function checkDrift(document: { paths?: Record<string, unknown> }, registered: string[]): string[] {
  const documented = new Set(Object.keys(document.paths ?? {}));
  const missing: string[] = [];
  for (const routePath of registered) {
    if (isInternalPath(routePath)) continue;
    const openApiPath = toOpenApiPath(routePath);
    if (!documented.has(openApiPath)) {
      missing.push(openApiPath);
    }
  }
  return missing;
}

/**
 * Ensure admin routes are not published without a security scheme. Any
 * documented path under /admin must declare a security requirement.
 */
function checkAdminSecurity(document: {
  paths?: Record<string, Record<string, { security?: unknown[] }>>;
}): string[] {
  const violations: string[] = [];
  for (const [path, methods] of Object.entries(document.paths ?? {})) {
    if (!path.startsWith('/admin')) continue;
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== 'object') continue;
      if (!Array.isArray(operation.security) || operation.security.length === 0) {
        violations.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return violations;
}

async function generate() {
  const checkOnly = process.argv.includes('--check');

  // Use require so tsconfig-paths resolves correctly with ts-node
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../src/app.module') as { AppModule: new () => object };

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('MyFans API')
    .setDescription('MyFans backend REST API')
    .setVersion('1.0')
    .addServer('/v1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const registered = collectRegisteredPaths(app);
  const missing = checkDrift(document, registered);
  const adminViolations = checkAdminSecurity(document);

  const outPath = join(__dirname, '..', 'openapi.json');

  if (checkOnly) {
    let failed = false;

    if (missing.length > 0) {
      failed = true;
      console.error('OpenAPI drift detected: undocumented controller paths:');
      for (const path of missing) console.error(`  - ${path}`);
      console.error(
        'Document these paths or add them to INTERNAL_PATH_PREFIXES in scripts/generate-openapi.ts.',
      );
    }

    if (adminViolations.length > 0) {
      failed = true;
      console.error('Admin routes missing a security scheme:');
      for (const route of adminViolations) console.error(`  - ${route}`);
    }

    if (!existsSync(outPath)) {
      failed = true;
      console.error(`Committed baseline not found at ${outPath}. Run the generator and commit it.`);
    } else {
      const committed = JSON.parse(readFileSync(outPath, 'utf8')) as {
        paths?: Record<string, unknown>;
      };
      const committedPaths = Object.keys(committed.paths ?? {}).sort();
      const currentPaths = Object.keys(document.paths ?? {}).sort();
      if (JSON.stringify(committedPaths) !== JSON.stringify(currentPaths)) {
        failed = true;
        console.error('Committed openapi.json is out of date. Re-run the generator and commit the result.');
      }
    }

    await app.close();

    if (failed) {
      process.exit(1);
    }
    console.log(`OpenAPI drift check passed (${registered.length} registered paths).`);
    return;
  }

  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outPath}`);

  if (missing.length > 0) {
    console.warn('Warning: undocumented controller paths detected:');
    for (const path of missing) console.warn(`  - ${path}`);
  }

  await app.close();
}

generate().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});

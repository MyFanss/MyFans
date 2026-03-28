/**
 * Startup secret validation.
 *
 * Checks that all required environment variables are present before the
 * application finishes bootstrapping. Throws immediately if any are missing
 * so the process exits with a clear error rather than failing silently at
 * runtime (which could leak partial state or fall back to insecure defaults).
 *
 * Add every secret/config key that the app cannot function without to
 * REQUIRED_SECRETS. Optional vars with safe defaults do NOT belong here.
 *
 * Stellar / Soroban variables are validated separately via `validateSorobanEnv()`
 * (see `soroban-env.validation.ts`).
 */

import { validateSorobanEnv } from './soroban-env.validation';

const REQUIRED_SECRETS: string[] = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
];

/**
 * Validates that all required secrets are present in the environment.
 * Call this once at the very start of `bootstrap()` before creating the app.
 *
 * @throws {Error} listing every missing variable so operators can fix all
 *   issues in one restart rather than discovering them one by one.
 */
export function validateRequiredSecrets(): void {
  const missing = REQUIRED_SECRETS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === '',
  );

  if (missing.length > 0) {
    throw new Error(
      `[secrets-validation] Missing required environment variables:\n` +
        missing.map((k) => `  - ${k}`).join('\n') +
        `\n\nSee backend/.env.example for the full list of required variables.`,
    );
  }

  validateSorobanEnv();
}

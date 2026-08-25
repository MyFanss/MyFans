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
 * In production, additionally validates that secrets are not CI placeholders.
 *
 * Stellar / Soroban variables are validated separately via `validateSorobanEnv()`
 * (see `soroban-env.validation.ts`).
 */

import { validateSorobanEnv } from './soroban-env.validation';

const REQUIRED_SECRETS: string[] = [
  'JWT_SECRET',
  'WEBHOOK_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
];

const CI_DEFAULT_SECRETS: Record<string, string> = {
  JWT_SECRET: 'ci-test-secret-not-for-production',
  WEBHOOK_SECRET: 'ci-webhook-secret-not-for-production',
};

/**
 * Validates that all required secrets are present in the environment.
 * Call this once at the very start of `bootstrap()` before creating the app.
 *
 * In production, also validates that secrets are not CI placeholder values.
 *
 * @throws {Error} listing every missing or invalid variable so operators can fix all
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

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    const ciDefaults = Object.entries(CI_DEFAULT_SECRETS)
      .filter(([key, defaultValue]) => process.env[key] === defaultValue)
      .map(([key]) => key);

    if (ciDefaults.length > 0) {
      throw new Error(
        `[secrets-validation] Production rejected CI placeholder secrets:\n` +
          ciDefaults.map((k) => `  - ${k}`).join('\n') +
          `\n\nThese secrets must be set to strong random values before deploying to production.\n` +
          `See backend/docs/SECRET_MANAGEMENT.md for guidance.`,
      );
    }
  }

  validateSorobanEnv();
  console.log('[config] validation ok');
}

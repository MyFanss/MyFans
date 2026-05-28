/**
 * Property-Based Tests: Startup Validation
 *
 * Feature: docker-compose-dev-profile
 * Property 1: Startup validation rejects missing required variables
 *
 * For any non-empty, incomplete subset of the required environment variables,
 * validateRequiredSecrets() must throw an error that names every missing key.
 *
 * Validates: Requirements 5.3
 */

import * as fc from 'fast-check';
import { validateRequiredSecrets } from '../common/secrets-validation';

const REQUIRED_KEYS = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
] as const;

describe('config.properties — startup validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all required keys from the environment before each test
    REQUIRED_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    // Restore original environment
    REQUIRED_KEYS.forEach((k) => delete process.env[k]);
    Object.assign(process.env, originalEnv);
  });

  /**
   * Property 1: For any non-empty, incomplete subset of required keys that
   * are present, validateRequiredSecrets() must throw and the error message
   * must name every missing key.
   *
   * We generate subsets of size 0..N-1 (never the full set) to ensure at
   * least one key is always missing.
   */
  it(
    'Property 1: rejects any incomplete set of required variables and names missing keys',
    () => {
      fc.assert(
        fc.property(
          // Generate a subset of REQUIRED_KEYS that is strictly smaller than the full set
          fc.subarray([...REQUIRED_KEYS], { minLength: 0, maxLength: REQUIRED_KEYS.length - 1 }),
          (presentKeys) => {
            // Set only the "present" keys in the environment
            REQUIRED_KEYS.forEach((k) => delete process.env[k]);
            presentKeys.forEach((k) => {
              process.env[k] = 'test-value';
            });

            const missingKeys = REQUIRED_KEYS.filter((k) => !presentKeys.includes(k));

            // There must be at least one missing key — the generator guarantees this
            expect(missingKeys.length).toBeGreaterThan(0);

            // validateRequiredSecrets must throw
            expect(() => validateRequiredSecrets()).toThrow();

            // The error message must mention every missing key
            try {
              validateRequiredSecrets();
            } catch (err: unknown) {
              const message = (err as Error).message;
              for (const key of missingKeys) {
                expect(message).toContain(key);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it('accepts the full set of required variables without throwing', () => {
    REQUIRED_KEYS.forEach((k) => {
      process.env[k] = 'test-value';
    });
    // STELLAR_NETWORK is validated by validateSorobanEnv — set a safe default
    process.env['STELLAR_NETWORK'] = 'testnet';

    // Should not throw when all required keys are present
    expect(() => validateRequiredSecrets()).not.toThrow();
  });
});

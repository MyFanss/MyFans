import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Redirect logger to a plain CJS file so jest.spyOn can redefine logError.
    // SWC compiles named exports as non-configurable; the .cjs file extension
    // is not matched by the SWC transform pattern so Node loads it with writable exports.
    '^@/lib/logger$': '<rootDir>/src/lib/logger.cjs',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    '/node_modules/',
    '\.cjs\.js$',
  ],
};

export default createJestConfig(config);

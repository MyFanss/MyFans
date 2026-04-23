#!/usr/bin/env ts-node
/**
 * scripts/run-migrations.ts
 *
 * Runs all TypeORM migrations against the configured Postgres database.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/run-migrations.ts
 *   npx ts-node -r tsconfig-paths/register scripts/run-migrations.ts --revert
 *
 * Environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * (same as .env.example)
 */
import 'reflect-metadata';
import { migrationDataSource } from '../src/migration.datasource';

const revert = process.argv.includes('--revert');

async function main() {
  await migrationDataSource.initialize();
  try {
    if (revert) {
      console.log('[migrations] reverting last migration…');
      await migrationDataSource.undoLastMigration();
      console.log('[migrations] revert complete');
    } else {
      console.log('[migrations] running pending migrations…');
      const ran = await migrationDataSource.runMigrations({ transaction: 'each' });
      if (ran.length === 0) {
        console.log('[migrations] no pending migrations');
      } else {
        ran.forEach((m) => console.log(`[migrations] ran: ${m.name}`));
      }
    }
  } finally {
    await migrationDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('[migrations] FAILED:', err);
  process.exit(1);
});

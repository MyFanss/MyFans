/**
 * Database Migration Runner
 * Usage: npx ts-node src/database/migrations.runner.ts [up|down]
 *
 * This script applies or rolls back all migrations in the correct order.
 * In production, run with proper error handling and backup procedures.
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0] || 'up';

if (!['up', 'down'].includes(command)) {
  console.error('Invalid command. Use: up or down');
  process.exit(1);
}

async function runMigrations() {
  // Create TypeORM DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'myfans',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'myfans',
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✓ Connected to database');

    const migrationsDir = path.join(__dirname, '../../migrations');
    const suffix = command === 'up' ? '.up.sql' : '.down.sql';
    let files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(suffix))
      .sort();

    if (command === 'down') {
      files = files.reverse();
    }

    console.log(`\n📦 Running ${command} migrations...\n`);

    for (const file of files) {
      const filepath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filepath, 'utf-8');

      console.log(`[${command.toUpperCase()}] ${file}`);
      await dataSource.query(sql);
      console.log(`✓ ${file} completed\n`);
    }

    console.log(`✓ All ${command} migrations completed successfully!`);
  } catch (error) {
    console.error(`✗ Migration failed:`, error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

void runMigrations();

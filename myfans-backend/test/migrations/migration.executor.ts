import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration executor for applying and rolling back SQL migrations
 * Reads migration files from the migrations directory
 */
export class MigrationExecutor {
  private dataSource: DataSource;
  private migrationsDir: string;

  constructor(dataSource: DataSource, migrationsDir: string) {
    this.dataSource = dataSource;
    this.migrationsDir = migrationsDir;
  }

  /**
   * Get all migration files in order
   */
  getMigrationFiles(direction: 'up' | 'down'): string[] {
    const suffix = direction === 'up' ? '.up.sql' : '.down.sql';
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith(suffix))
      .sort();
    return files;
  }

  /**
   * Read migration file content
   */
  private readMigration(filename: string): string {
    const filepath = path.join(this.migrationsDir, filename);
    return fs.readFileSync(filepath, 'utf-8');
  }

  /**
   * Apply up migrations
   */
  async migrateUp(): Promise<void> {
    const migrations = this.getMigrationFiles('up');
    for (const migration of migrations) {
      console.log(`Applying migration: ${migration}`);
      const sql = this.readMigration(migration);
      await this.dataSource.query(sql);
    }
  }

  /**
   * Rollback down migrations in reverse order
   */
  async migrateDown(): Promise<void> {
    const migrations = this.getMigrationFiles('down').reverse();
    for (const migration of migrations) {
      console.log(`Rolling back migration: ${migration}`);
      const sql = this.readMigration(migration);
      await this.dataSource.query(sql);
    }
  }

  /**
   * Get table names from the database
   */
  async getTableNames(): Promise<string[]> {
    const result = await this.dataSource.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return result.map((row: any) => row.table_name);
  }

  /**
   * Get indexes for a table
   */
  async getTableIndexes(tableName: string): Promise<any[]> {
    return await this.dataSource.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`,
      [tableName],
    );
  }

  /**
   * Verify foreign key constraints exist
   */
  async getForeignKeys(tableName: string): Promise<any[]> {
    return await this.dataSource.query(
      `SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
      [tableName],
    );
  }

  /**
   * Get column names for a table
   */
  async getTableColumns(tableName: string): Promise<string[]> {
    const result = await this.dataSource.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = $1 ORDER BY ordinal_position`,
      [tableName],
    );
    return result.map((row: any) => row.column_name);
  }
}

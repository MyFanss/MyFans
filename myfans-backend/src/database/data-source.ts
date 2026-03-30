import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Creator } from './entities/creator.entity';
import { Plan } from './entities/plan.entity';
import { Content } from './entities/content.entity';
import { Subscription } from './entities/subscription.entity';

/**
 * TypeORM Data Source Configuration
 * Used for both development/production and migrations
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'myfans',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'myfans',
  synchronize: process.env.NODE_ENV !== 'production', // Use migrations in production
  logging: process.env.DB_LOGGING === 'true',
  entities: [User, Creator, Plan, Content, Subscription],
  migrations: ['migrations/*.ts'], // TypeORM-managed migrations if using them
  subscribers: [],
  cli: {
    entitiesDir: 'src/database/entities',
    migrationsDir: 'migrations',
    subscribersDir: 'src/database/subscribers',
  },
});

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✓ Database connection established');
    }
  } catch (error) {
    console.error('✗ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Health check query
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await AppDataSource.query('SELECT 1');
    return result.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

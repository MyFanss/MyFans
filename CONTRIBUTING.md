# Contributing Guide

## Adding a New Database Entity

When adding a new feature that requires a database table, follow this checklist to ensure your entity is properly registered:

### Checklist

1. **Create the entity class** in your module's `entities/` directory (e.g., `src/mymodule/entities/my-entity.entity.ts`)
   - Use `@Entity()` decorator from TypeORM
   - Define all columns and relationships

2. **Register in module's TypeOrmModule**
   - Add the entity to `TypeOrmModule.forFeature([MyEntity, ...])` in your module's imports
   - This makes the entity available for dependency injection at runtime

3. **Add to migration datasource** (`backend/src/migration.datasource.ts`)
   - Import your entity class
   - Add it to the `entities` array in the `DataSource` config
   - **Why:** Migrations run outside the NestJS DI container. The datasource must declare all entities so TypeORM CLI and migration runners can reference them. Without this, auto-migration generation and schema comparison may fail or produce incomplete migrations.

4. **Create a migration if adding to existing tables**
   - If modifying an existing table: `npm run migration:generate -- src/mymodule/<timestamp>-DescribeChange`
   - If creating a new table, you may rely on TypeORM's auto-generation or write SQL manually
   - Ensure the migration is added to `migration.datasource.ts`'s migrations array

5. **Test**
   - Run `npm run migration:run` locally to verify the migration applies cleanly
   - Verify the table structure with `\d table_name` in psql

### Example

```typescript
// src/mymodule/entities/my-entity.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('my_entities')
export class MyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
```

```typescript
// src/mymodule/mymodule.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { MyEntity } from './entities/my-entity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MyEntity])],
  // ...
})
export class MyModule {}
```

```typescript
// backend/src/migration.datasource.ts
import { MyEntity } from './mymodule/entities/my-entity.entity';

export const migrationDataSource = new DataSource({
  // ...
  entities: [
    // ... existing entities ...
    MyEntity,
  ],
});
```

## Testing Migrations

Run the migration integration test to verify all registered entities' tables exist:

```bash
npm run test:migrations
```

This test runs all migrations against a fresh Postgres instance and verifies that every expected table and column exists.

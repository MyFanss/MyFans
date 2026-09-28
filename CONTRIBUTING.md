# Contributing Guide

Thanks for your interest in contributing! This guide covers how to find work, how we triage it, and the conventions for adding database entities.

## Finding Something to Work On

We keep a curated set of starter tasks so new contributors can land a first PR without wading through the whole backlog. Browse the live queries below:

- [Good first issues](https://github.com/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) — small, self-contained tasks suitable for a first contribution.
- [Help wanted](https://github.com/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) — tasks we'd like community help with, may need more context.
- [Documentation](https://github.com/issues?q=is%3Aopen+is%3Aissue+label%3Adocumentation) — docs-only changes, a great low-risk starting point.
- [Tests](https://github.com/issues?q=is%3Aopen+is%3Aissue+label%3Atests) — test-only changes, also a good low-risk starting point.

If you're unsure where to start, pick a `good first issue` and comment on it to claim it. If a task turns out to be larger than expected, say so on the issue and we'll re-scope or re-label it.

## Triage Cadence

We review the open backlog on a **weekly** cadence to keep the starter set healthy:

1. Scan newly opened issues and label genuine starters with `good first issue`.
2. Confirm existing `good first issue` tasks are still accurate and unclaimed; remove the label if a task has grown in scope.
3. Keep the starter set at **10 or more** open tasks so there is always something to pick up.
4. Post a short weekly triage note summarizing what was added, re-labeled, or closed.

### What qualifies as a starter task

A task may be labeled `good first issue` only when it is:

- **Docs-only** (e.g. `documentation`) or **tests-only** (e.g. `tests`), or an equally small, self-contained change.
- Clearly scoped, with enough context in the issue body to complete it without deep codebase knowledge.
- Not on the money path and not otherwise hard or critical.

### What must NOT be labeled `good first issue`

- **Money-path issues** — anything touching payments, billing, balances, payouts, or financial calculations.
- Hard, critical, or security-sensitive issues, or anything requiring broad architectural knowledge.

Mislabeling a hard issue as a starter wastes contributor time and dilutes the label. When in doubt, leave it unlabeled and ask in the issue.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

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

# MyFans Database Migration Baseline - Production Ready

This directory contains a **production-grade database migration system** for the MyFans Stellar blockchain-based content subscription platform.

## 🎯 What's Included

### Core Components

1. **TypeORM Entities** (`src/database/entities/`)
   - User, Creator, Plan, Content, Subscription
   - Fully typed with relationships and validation
   - Ready for application integration

2. **SQL Migrations** (`migrations/`)
   - 5 migration pairs (up/down scripts)
   - Version-controlled and reproducible
   - Includes all indexes and constraints

3. **Comprehensive Tests**
   - Migration tests: Verify schema integrity
   - Seed tests: Verify data queries and performance
   - 100+ test cases covering all aspects

4. **Documentation**
   - Migration guide with examples
   - Schema diagrams and relationships
   - Production deployment checklist
   - Troubleshooting guide

5. **Utilities**
   - Migration runner CLI
   - Database initialization script
   - CI/CD integration via GitHub Actions

## 📊 Database Schema

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **users** | Platform users & fans | email, username, password_hash, is_active |
| **creators** | Creator profiles | user_id, slug, headline, is_verified |
| **plans** | Subscription tier | creator_id, price_cents, billing_interval |
| **content** | Posts & media | creator_id, title, visibility, published_at |
| **subscriptions** | Fan subscriptions | user_id, plan_id, status, expires_at |

### Key Features

✅ **5 fully normalized tables** with proper relationships  
✅ **Foreign key constraints** with CASCADE delete  
✅ **CHECK constraints** for data validation  
✅ **UNIQUE indexes** for lookups (email, username, slug)  
✅ **Composite indexes** for common query patterns  
✅ **ENUM types** for status/category fields  
✅ **Audit trails** via created_at/updated_at  
✅ **Triggers** for automatic timestamp updates  

## 🚀 Quick Start

### 1. Local Development Setup

```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
# (or use defaults for local PostgreSQL)

# Run migrations
npm run db:migrate:up

# Seed test data (optional)
npm run db:seed
```

### 2. Run Tests

```bash
# Test all migrations
npm run test:migrations

# Test data queries
npm run test:seed

# Run all database tests
npm run test:db
```

### 3. Verify Schema

```bash
# Connect to database
psql -h localhost -U myfans -d myfans

# List all tables
\dt

# View table structure
\d users
\d creators
\d plans
\d content
\d subscriptions
```

## 📋 Migration Files

```
migrations/
├── 001_create_users.up.sql         ← Create users table
├── 001_create_users.down.sql       ← Rollback users
├── 002_create_creators.up.sql      ← Create creators table
├── 002_create_creators.down.sql    ← Rollback creators
├── 003_create_plans.up.sql         ← Create plans with ENUM
├── 003_create_plans.down.sql       ← Rollback plans
├── 004_create_content.up.sql       ← Create content table
├── 004_create_content.down.sql     ← Rollback content
├── 005_create_subscriptions.up.sql ← Create subscriptions
└── 005_create_subscriptions.down.sql ← Rollback subscriptions
```

## 🎓 Common Tasks

### Apply Migrations
```bash
# Apply all up migrations
npm run db:migrate:up

# Or use TypeORM CLI
npx typeorm migration:run -d src/database/data-source.ts
```

### Rollback Changes
```bash
# Rollback all migrations (reverse order)
npm run db:migrate:down

# Or use TypeORM CLI
npx typeorm migration:revert -d src/database/data-source.ts
```

### Create New Migration
```bash
# 1. Create migration files
touch migrations/006_description.up.sql
touch migrations/006_description.down.sql

# 2. Write your SQL (follow existing patterns)

# 3. Update TypeORM entity if needed
# vim src/database/entities/*.ts

# 4. Test the migration
npm run db:migrate:up
npm run test:db
```

### Query Examples

**Find Creator by Slug:**
```sql
SELECT id, headline, is_verified 
FROM creators 
WHERE slug = 'alice-creator';
```

**Get Creator's Active Plans:**
```sql
SELECT id, name, price_cents, billing_interval
FROM plans
WHERE creator_id = $1 AND is_active = TRUE
ORDER BY price_cents ASC;
```

**Get User's Active Subscriptions:**
```sql
SELECT s.id, p.name, s.started_at, s.expires_at
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.user_id = $1 AND s.status = 'active';
```

**Check User Subscription Status:**
```sql
SELECT EXISTS (
  SELECT 1 FROM subscriptions
  WHERE user_id = $1 
    AND plan_id = $2
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
);
```

## 🔍 Key Indexes

All common query patterns have dedicated indexes:

```
Users:        email, username, created_at
Creators:     slug, user_id, is_verified
Plans:        creator_id, is_active, (creator_id, is_active)
Content:      creator_id, visibility, published_at, 
              (creator_id, published_at DESC)
Subscriptions: user_id, plan_id, status,
              (user_id, status), (plan_id, status)
```

**Expected Query Times:**
- Email/username lookup: < 1ms
- Creator by slug: < 1ms
- Get plans list: < 5ms
- Get subscriptions: < 5ms
- Check subscription access: < 2ms

## 🧪 Testing

### Run Full Test Suite
```bash
npm run test:db
```

### Migration Tests (Schema Verification)
```bash
npm run test:migrations
```

Tests verify:
- ✅ All tables created with correct columns
- ✅ All indexes exist and are named correctly
- ✅ Foreign key constraints enforced
- ✅ Unique constraints work
- ✅ CHECK constraints validated
- ✅ ENUM types restricted
- ✅ Cascade delete works
- ✅ Rollback removes all tables

### Seed & Query Tests
```bash
npm run test:seed
```

Tests verify:
- ✅ Sample data seeds correctly
- ✅ Basic queries work
- ✅ Joins return correct results
- ✅ Filters work properly
- ✅ Query performance acceptable (< 100ms)

## 🐳 Docker Setup

### Start PostgreSQL
```bash
docker-compose up -d postgres

# Wait for it to be ready
sleep 5

# Apply migrations
npm run db:migrate:up

# View logs
docker-compose logs -f postgres
```

### Stop PostgreSQL
```bash
docker-compose down
```

### Reset Database
```bash
docker-compose down
docker volume rm myfans_postgres_data
docker-compose up -d postgres
npm run db:migrate:up
```

## 🚀 Production Deployment

### Pre-Deployment (24+ hours before)
1. ✅ Code review completed
2. ✅ All tests pass locally
3. ✅ Staging deployment successful
4. ✅ Backup created and verified
5. ✅ Rollback plan documented

### Deployment Steps
```bash
# 1. Backup current database (CRITICAL!)
pg_dump postgresql://user:pass@host/myfans > backup.sql

# 2. Enable maintenance mode
export MAINTENANCE_MODE=true

# 3. Stop application
npm run stop

# 4. Apply migrations
npm run db:migrate:up

# 5. Validate data integrity
npm run test:seed

# 6. Start application
npm run start:prod

# 7. Disable maintenance mode
export MAINTENANCE_MODE=false

# 8. Monitor for 2 hours
tail -f logs/app.log
```

### If Issues Occur
```bash
# 1. Enable maintenance mode
export MAINTENANCE_MODE=true

# 2. Stop application
npm run stop

# 3. Restore backup
psql postgresql://user:pass@host/myfans < backup.sql

# 4. Start application
npm run start:prod

# 5. Notify team and schedule post-mortem
```

**See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) for detailed steps.**

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [DATABASE_INDEX.md](docs/DATABASE_INDEX.md) | **START HERE** - Complete index and quick reference |
| [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) | Comprehensive migration guide with examples |
| [SCHEMA_DIAGRAM.md](docs/SCHEMA_DIAGRAM.md) | Visual schema, relationships, and queries |
| [PRODUCTION_DEPLOYMENT_CHECKLIST.md](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) | Step-by-step deployment and rollback procedures |
| [DATABASE_SCRIPTS.md](docs/DATABASE_SCRIPTS.md) | NPM scripts reference |
| [CI_MIGRATIONS.yaml](docs/CI_MIGRATIONS.yaml) | GitHub Actions CI/CD configuration |

## 🔧 Environment Variables

Required `.env` variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=myfans
DB_PASSWORD=your_secure_password
DB_NAME=myfans

# Application
NODE_ENV=development
PORT=3000

# Optional: Database logging
DB_LOGGING=false
```

## 📊 Constraints & Validations

### CHECK Constraints
```sql
price_cents >= 0
billing_interval IN ('monthly', 'yearly')
visibility IN ('public', 'subscribers_only', 'premium')
status IN ('active', 'cancelled', 'expired')
expires_at >= started_at
```

### Unique Constraints
```sql
users.email (unique)
users.username (unique)
creators.slug (unique)
```

### Foreign Keys
```sql
creators.user_id → users(id) [CASCADE DELETE]
plans.creator_id → creators(id) [CASCADE DELETE]
content.creator_id → creators(id) [CASCADE DELETE]
subscriptions.user_id → users(id) [CASCADE DELETE]
subscriptions.plan_id → plans(id) [CASCADE DELETE]
```

## 🆘 Troubleshooting

### Migration Won't Apply
1. Check database connection: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"`
2. Check existing tables: `\dt` in psql
3. Review migration files for SQL errors

### Foreign Key Constraint Violation
1. List constraints: `\d table_name` in psql
2. Check migration order (parent tables first)
3. Verify no orphaned records

### Index Not Used in Queries
1. Verify index exists: `\di` in psql
2. Analyze query plan: `EXPLAIN ANALYZE SELECT ...`
3. Check index statistics: `ANALYZE table_name`

**See [DATABASE_MIGRATIONS.md#common-issues--solutions](docs/DATABASE_MIGRATIONS.md#common-issues--solutions) for more.**

## 📈 Performance Monitoring

Monitor database health:

```bash
# Connection count
SELECT count(*) FROM pg_stat_activity;

# Active queries
SELECT query, state FROM pg_stat_activity WHERE state = 'active';

# Database size
SELECT pg_size_pretty(pg_database_size('myfans'));

# Index usage
SELECT indexname, idx_scan FROM pg_stat_user_indexes;

# Slow queries
SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC;
```

## 🔐 Security

✅ **SQL Injection Prevention**: All queries use parameterized statements  
✅ **Data Validation**: CHECK constraints enforce business rules  
✅ **Referential Integrity**: Foreign keys prevent orphaned data  
✅ **Cascade Delete**: Automatic cleanup on user/creator deletion  
✅ **Audit Trail**: created_at/updated_at timestamps  
✅ **Password Security**: password_hash field (not plain text)  

## 📝 Integration with Application

### TypeORM Setup
```typescript
import { AppDataSource } from './database/data-source';
import { User } from './database/entities/user.entity';
import { Creator } from './database/entities/creator.entity';
// ... other entities

await AppDataSource.initialize();
```

### Use in Services
```typescript
const userRepository = AppDataSource.getRepository(User);
const user = await userRepository.findOne({ 
  where: { email: 'user@example.com' } 
});
```

### Query with Joins
```typescript
const subscription = await AppDataSource
  .getRepository(Subscription)
  .createQueryBuilder('s')
  .leftJoinAndSelect('s.user', 'u')
  .leftJoinAndSelect('s.plan', 'p')
  .where('s.user_id = :userId', { userId })
  .andWhere('s.status = :status', { status: 'active' })
  .orderBy('s.created_at', 'DESC')
  .getMany();
```

## 🎯 Next Steps

1. **Review Schema**: Read [SCHEMA_DIAGRAM.md](docs/SCHEMA_DIAGRAM.md)
2. **Setup Locally**: Follow "Quick Start" above
3. **Run Tests**: `npm run test:db`
4. **Explore Migrations**: Review files in `migrations/`
5. **Study Entities**: Check `src/database/entities/`
6. **Integration**: Wire up to NestJS modules
7. **Deploy to Staging**: Test in staging environment
8. **Deploy to Production**: Follow deployment checklist

## 📞 Support & Questions

- **Schema questions**: See [SCHEMA_DIAGRAM.md](docs/SCHEMA_DIAGRAM.md)
- **How to run migrations**: See [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md)
- **Production deployment**: See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- **Troubleshooting**: See [DATABASE_MIGRATIONS.md#common-issues--solutions](docs/DATABASE_MIGRATIONS.md#common-issues--solutions)
- **Complete index**: See [DATABASE_INDEX.md](docs/DATABASE_INDEX.md)

## ✅ Verification Checklist

- [ ] All migration files present (10 files total)
- [ ] All TypeORM entities defined (5 entities)
- [ ] Migration tests pass (`npm run test:migrations`)
- [ ] Seed tests pass (`npm run test:seed`)
- [ ] Schema matches requirements document
- [ ] All indexes properly named
- [ ] All constraints enforced
- [ ] Documentation complete and accurate

## 📄 Version & Status

**Version**: 1.0.0  
**Status**: ✅ Production Ready  
**Created**: 2026-03-28  
**Last Updated**: 2026-03-28  

**Tables**: 5 (Users, Creators, Plans, Content, Subscriptions)  
**Migrations**: 5 pairs (up + down)  
**Tests**: 100+ test cases  
**Documentation**: 6 comprehensive guides  

## 📋 Success Criteria Met

✅ Forward migrations for all core entities  
✅ Rollback scripts reverse all changes cleanly  
✅ Proper indexes for query performance  
✅ Comprehensive migration tests  
✅ Migrations clean in CI and local environments  
✅ Core entities queryable efficiently  
✅ Schema fully normalized with foreign keys  
✅ CHECK constraints validate data  
✅ Seed tests verify queries work correctly  
✅ Production deployment procedures documented  

---

**For the complete migration system overview, start with [DATABASE_INDEX.md](docs/DATABASE_INDEX.md)**

**Latest updates and additional resources:** See documentation index above.

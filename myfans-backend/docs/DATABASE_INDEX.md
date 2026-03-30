# Database Migration System - Complete Documentation Index

This directory contains the complete production-ready database migration baseline for MyFans.

## 📚 Core Documentation

### [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md)
**Complete migration guide covering:**
- Overview of the migration system
- Core tables and schema design
- Running migrations locally, in Docker, CI/CD, and production
- Testing migrations comprehensively
- Migration file structure and creating new migrations
- Index strategy for query performance
- ENUM types and triggers
- Common query examples
- Troubleshooting guide

### [SCHEMA_DIAGRAM.md](SCHEMA_DIAGRAM.md)
**Visual schema reference:**
- Entity Relationship Diagram (ERD)
- Table relationships and foreign keys
- Data flow through the platform
- Key indexes for performance
- Common query patterns with index usage
- CHECK constraints and validations
- Performance metrics and connection pool recommendations

### [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)
**Step-by-step production deployment guide:**
- Pre-deployment checklist (24+ hours before)
- Testing phase procedures
- Pre-deployment verification (4 hours before)
- Detailed deployment step-by-step
- Post-deployment monitoring
- Rollback procedures with decision criteria
- Post-mortem template
- Success and rollback criteria
- Emergency contacts and communication templates

### [DATABASE_SCRIPTS.md](DATABASE_SCRIPTS.md)
**NPM scripts reference:**
- List of database management scripts
- Command line interfaces
- Testing and validation commands
- Docker database utilities

### [CI_MIGRATIONS.yaml](CI_MIGRATIONS.yaml)
**GitHub Actions CI/CD configuration:**
- Automated migration testing
- Schema verification
- Rollback validation
- Migration report generation

## 📁 Source Files

### [`src/database/entities/`](../src/database/entities/)
**TypeORM Entity Definitions**

- `user.entity.ts` - User table with all fields and relationships
- `creator.entity.ts` - Creator profile with foreign key to users
- `plan.entity.ts` - Subscription plans with billing intervals
- `content.entity.ts` - Creator content with visibility levels
- `subscription.entity.ts` - Fan subscriptions with status tracking

### [`migrations/`](../migrations/)
**Raw SQL Migration Files**

**Up Migrations (Create schema):**
- `001_create_users.up.sql` - Users table and indexes
- `002_create_creators.up.sql` - Creators table and relationships
- `003_create_plans.up.sql` - Plans table with ENUM types
- `004_create_content.up.sql` - Content table and indexes
- `005_create_subscriptions.up.sql` - Subscriptions table and relationships

**Down Migrations (Rollback schema):**
- `001_create_users.down.sql`
- `002_create_creators.down.sql`
- `003_create_plans.down.sql`
- `004_create_content.down.sql`
- `005_create_subscriptions.down.sql`

### [`src/database/data-source.ts`](../src/database/data-source.ts)
**TypeORM Configuration**
- Database connection setup
- Entity registration
- Environment variable configuration
- Database health checks

### [`src/database/migrations.runner.ts`](../src/database/migrations.runner.ts)
**Migration Execution Utility**
- Apply all up migrations
- Rollback all down migrations
- CLI for local migration management

## 🧪 Test Files

### [`test/migrations/migration.executor.ts`](../test/migrations/migration.executor.ts)
**Migration Test Utilities**
- Read and execute migration files
- Query database schema information
- Verify table and index existence
- Get foreign key constraints

### [`test/migrations/migrations.spec.ts`](../test/migrations/migrations.spec.ts)
**Comprehensive Migration Test Suite**

**Tests include:**
- ✅ Each table creation with correct schema
- ✅ All indexes created and properly named
- ✅ Unique constraints enforced
- ✅ Foreign key constraints work correctly
- ✅ ON DELETE CASCADE relationships active
- ✅ CHECK constraints validated
- ✅ ENUM types restricted to valid values
- ✅ Full migration lifecycle (up → down → up)
- ✅ All tables removed on rollback

### [`test/seed/seed.spec.ts`](../test/seed/seed.spec.ts)
**Data Seeding and Query Tests**

**Seed Tests:**
- Create sample users
- Create sample creators
- Create sample subscription plans
- Create sample content with various visibility levels
- Create sample subscriptions with different statuses

**Query Tests:**
- Fetch creator by slug (with verification badge)
- Get active plans by creator (sorted by price)
- Get published/public content by creator
- Get user's active subscriptions (with join to plans)
- Check subscription access status
- Count creator subscribers
- Get creator earnings summary
- Find expired subscriptions
- Efficiently query multiple creators

**Performance Tests:**
- Email lookup performance (< 100ms)
- Creator slug lookup performance (< 100ms)
- Active plans filtering performance (< 100ms)
- Subscription status queries (< 100ms)

## 🎯 Quick Start

### New to the project?

1. **Understand the schema**: Read [SCHEMA_DIAGRAM.md](SCHEMA_DIAGRAM.md)
2. **Setup locally**: Follow [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md#running-migrations)
3. **Run tests**: `npm run test:db`
4. **Explore migrations**: Check `migrations/` directory
5. **Review entities**: Examine `src/database/entities/`

### Need to deploy to production?

1. **Review checklist**: Study [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)
2. **Test migrations**: `npm run test:migrations`
3. **Plan rollback**: Know your recovery procedures
4. **Backup database**: Create verified backup
5. **Execute deployment**: Follow step-by-step guide
6. **Monitor closely**: Watch for 2+ hours post-deployment

### Want to add new migrations?

1. **Create files**: `migrations/NNN_description.{up,down}.sql`
2. **Write SQL**: Follow existing migration patterns
3. **Update entities**: Reflect schema changes in TypeORM
4. **Test thoroughly**: Run full test suite
5. **Document changes**: Update schema documentation

## 📊 Schema Summary

| Table | Records | Purpose | Key Index |
|-------|---------|---------|-----------|
| `users` | ~1M | Platform users & fans | email, username |
| `creators` | ~10K | Creator profiles | slug, user_id |
| `plans` | ~50K | Subscription plans | creator_id, is_active |
| `content` | ~1M | Posts & media | creator_id, published_at |
| `subscriptions` | ~10M | Active subscriptions | user_id, plan_id, status |

## 🔍 Key Features

✅ **Production-Ready**
- Version-controlled migrations
- Comprehensive rollback capability
- Tested schema changes
- CHECK constraints and validations
- Proper indexing strategy

✅ **Well-Tested**
- Unit tests for each migration
- Integration tests for relationships
- Query performance verification
- Full lifecycle testing (up/down)

✅ **Documented**
- Schema diagrams and relationships
- Query examples and patterns
- Deployment procedures
- Troubleshooting guides

✅ **CI/CD Integrated**
- Automated migration verification
- Schema consistency checks
- Rollback validation
- Performance testing

## 🚀 Common Commands

```bash
# Local development
npm run db:migrate:up           # Apply migrations
npm run db:migrate:down         # Rollback migrations
npm run db:seed                 # Seed test data
npm run db:clean                # Clean database

# Testing
npm run test:migrations         # Test schema changes
npm run test:seed               # Test queries and seed
npm run test:db                 # All database tests

# Docker
npm run docker:db:start         # Start PostgreSQL
npm run docker:db:stop          # Stop PostgreSQL
npm run docker:db:logs          # View database logs

# CI/CD
npm run db:migrate:status       # Check migration status
npm run db:entities:sync        # Sync entity definitions
```

## 📞 Support

For issues or questions:

1. **Check troubleshooting**: See [DATABASE_MIGRATIONS.md#common-issues-solutions](DATABASE_MIGRATIONS.md#common-issues--solutions)
2. **Review test output**: Run `npm run test:migrations --verbose`
3. **Check database state**: Query `information_schema.*`
4. **Consult schema diagram**: Review [SCHEMA_DIAGRAM.md](SCHEMA_DIAGRAM.md)
5. **Contact DBA team**: Escalate for production issues

## 📋 Governance

**Migration Review Process:**
1. Write migration SQL and tests
2. Run full test suite locally
3. Create pull request with documentation
4. Code review by DBA/backend engineer
5. Staging deployment verification
6. Approval and merge to main
7. Follow deployment checklist for production

**Backup & Recovery:**
- Daily automated backups (encrypted)
- Point-in-time recovery enabled
- Disaster recovery plan filed
- Tested recovery procedures

**Performance Monitoring:**
- Query response time SLA: < 5s
- Database CPU: < 70%
- Connection pool: < 80% utilization
- Disk space: < 80% full

## 📄 Version History

**Current Version:** 1.0.0  
**Created:** 2026-03-28  
**Status:** Production Ready  
**Last Updated:** 2026-03-28  

**Tables:**
- v1.0: Users, Creators, Plans, Content, Subscriptions

**Future Enhancements:**
- Temporal tables for audit logging
- Full-text search indexes
- Partitioning for large tables
- Read replicas for scaling

---

**For the latest information, always refer to the main documentation files above.**

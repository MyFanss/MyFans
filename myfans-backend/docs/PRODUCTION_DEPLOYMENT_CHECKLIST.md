# Production Database Migration Deployment Checklist

## Pre-Deployment (24+ hours before)

- [ ] Code review completed for all migration files
- [ ] All migration tests pass (100% success rate required)
- [ ] Schema changes documented in pull request
- [ ] Rollback plan documented and tested
- [ ] Index strategy reviewed for query performance
- [ ] Foreign key relationships verified
- [ ] ENUM types and constraints validated
- [ ] Backup/disaster recovery plan in place
- [ ] Database size and growth projections reviewed
- [ ] Stakeholder notification sent (if breaking changes)

## Testing Phase (48 hours before)

### Local Testing
- [ ] Run migrations on local development database
- [ ] Run migration test suite (`npm run test:migrations`)
- [ ] Run seed and query tests (`npm run test:seed`)
- [ ] Verify rollback works cleanly
- [ ] Verify indexes exist and are used
- [ ] Check query performance (< 100ms for critical queries)

### Staging Environment
- [ ] Deploy code to staging
- [ ] Copy production backup to staging
- [ ] Run migrations on staging copy
- [ ] Run full test suite on staging
- [ ] Load test with realistic data volume
- [ ] Verify all application features work
- [ ] Check monitoring/alerting
- [ ] Test rollback on staging

### Data Validation
- [ ] Verify data integrity post-migration
- [ ] Check foreign key constraints are satisfied
- [ ] Verify no orphaned records
- [ ] Audit records count matches expected
- [ ] Sample queries return correct results

## Pre-Deployment Checklist (4 hours before)

- [ ] Final code review of all changes
- [ ] All tests passing in CI/CD pipeline
- [ ] Staging deployment successful
- [ ] No blocking issues reported
- [ ] Database backup completed (verify backup integrity)
- [ ] Backup stored securely (off-site)
- [ ] On-call team briefed
- [ ] Communication channels open (Slack, PagerDuty)
- [ ] Rollback plan printed and accessible
- [ ] Deployment window locked with team

## Deployment Steps (Production)

### Step 1: Preparation (30 minutes before)
```bash
# Verify database connection
psql $DB_CONNECTION_STRING -c "SELECT 1"

# Check database size
psql $DB_CONNECTION_STRING -c "SELECT pg_size_pretty(pg_database_size('myfans'))"

# Record current state
psql $DB_CONNECTION_STRING -c "\dt" > /tmp/pre-migration-tables.txt

# Create backup
pg_dump $DB_CONNECTION_STRING | gzip > /tmp/backup-$(date +%s).sql.gz

# Verify backup
gunzip -t /tmp/backup-*.sql.gz
```

### Step 2: Enable Maintenance Mode
```bash
# Set application to read-only mode
# Notify users of maintenance window
# Stop accepting new connections
export DB_READ_ONLY=true
```

### Step 3: Application Pause
```bash
# Gracefully shut down application
npm run stop

# Wait for connections to drain (60+ seconds)
sleep 60

# Verify no active connections
psql $DB_CONNECTION_STRING -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'myfans'"
```

### Step 4: Execute Migrations
```bash
# Run migrations with logging
npm run db:migrate:up | tee /tmp/migration-$(date +%s).log

# Verify all tables created
psql $DB_CONNECTION_STRING -c "\dt"

# Verify all indexes created
psql $DB_CONNECTION_STRING -c "\di"

# Record post-migration state
psql $DB_CONNECTION_STRING -c "\dt" > /tmp/post-migration-tables.txt
```

### Step 5: Data Validation (CRITICAL)
```bash
# Count records in each table
for table in users creators plans content subscriptions; do
  count=$(psql $DB_CONNECTION_STRING -t -c "SELECT COUNT(*) FROM $table")
  echo "$table: $count records"
done

# Verify foreign key integrity
psql $DB_CONNECTION_STRING -c "
  SELECT tc.table_name, tc.constraint_name, COUNT(*)
  FROM information_schema.table_constraints tc
  WHERE tc.constraint_type = 'FOREIGN KEY'
  GROUP BY tc.table_name, tc.constraint_name
"

# Check for constraint violations
psql $DB_CONNECTION_STRING -c "
  SELECT * FROM pg_constraint 
  WHERE contype = 'f' AND convalidated = false
"
```

### Step 6: Application Restart
```bash
# Start application (still in read-only mode)
npm run start:prod

# Wait for application to be ready
sleep 30

# Verify health check passes
curl -f http://localhost:3000/health || exit 1

# Run smoke tests
npm run test:smoke

# Verify critical endpoints work
curl -f http://localhost:3000/api/v1/creators
curl -f http://localhost:3000/api/v1/plans
```

### Step 7: Disable Maintenance Mode
```bash
# Re-enable write access
export DB_READ_ONLY=false

# Notify users maintenance is complete
# Monitor for issues
```

### Step 8: Post-Deployment Monitoring (2 hours)
```bash
# Monitor application logs
tail -f /var/log/myfans/backend.log

# Monitor database performance
watch -n 1 'psql $DB_CONNECTION_STRING -c "SELECT count(*) FROM pg_stat_activity"'

# Monitor system metrics (CPU, memory, disk, I/O)
# Verify response times
# Check error rates
# Monitor slow query logs
```

## Post-Deployment Checklist

- [ ] All application features working
- [ ] No database errors in logs
- [ ] Query performance acceptable (SLA met)
- [ ] No orphaned data
- [ ] Backups are accessible and verified
- [ ] Monitoring alerts working
- [ ] Team standby for 2 hours
- [ ] Update deployment log

## Rollback Plan (If Issues)

### Decision Point
If critical issues occur:
- Response time > 5s
- Error rate > 1%
- Database connection failures
- Foreign key violations
- Data corruption detected

### Immediate Actions
```bash
# 1. Enable maintenance mode
export DB_READ_ONLY=true

# 2. Gracefully shut down application
npm run stop

# 3. Wait for connections to drain
sleep 60

# 4. Verify current backup available
ls -lh /tmp/backup-*.sql.gz

# 5. Restore from pre-migration backup
export PGPASSWORD=$DB_PASSWORD
psql -h $DB_HOST -U $DB_USER -c "
  DROP DATABASE IF EXISTS myfans_backup;
  CREATE DATABASE myfans_backup TEMPLATE myfans;
"

# 6. Verify restored database
psql -h $DB_HOST -U $DB_USER -d myfans -c "SELECT COUNT(*) FROM users"

# 7. Switch to old database
# (Update application connection string to myfans_backup)

# 8. Restart application
npm run start:prod

# 9. Verify health
curl http://localhost:3000/health

# 10. Disable maintenance mode
export DB_READ_ONLY=false

# 11. Inform stakeholders
# 12. Schedule post-mortem
```

## Post-Mortem (24 hours after successful deployment)

- [ ] Team retrospective held
- [ ] Any issues documented and resolved
- [ ] Lessons learned captured
- [ ] Process improvements identified
- [ ] Documentation updated
- [ ] Team debriefed

## Success Criteria

✅ **Deployment is successful if:**
- All migrations applied without errors
- Zero data loss
- All application tests pass
- Query performance within SLA
- No orphaned records
- Backup verified and accessible
- Team confident in rollback capability
- Users report no issues within 2 hours

## Rollback Success Criteria

✅ **Rollback is successful if:**
- Original state fully restored
- All data intact and verified
- Application functioning normally
- No lasting side effects
- Team debriefed on failure cause
- New test cases added to prevent recurrence

## Emergency Contacts

- **Database DBA**: [contact]
- **DevOps Lead**: [contact]
- **On-Call Engineer**: [contact]
- **Product Manager**: [contact]

## Communication Template

### Pre-Deployment
Subject: MyFans Database Maintenance - [DATE] [TIME-TIME] UTC

Content:
```
We will be performing database migrations to improve platform performance.
Timeline: [START] - [END] UTC (approximately [DURATION] minutes)
Expected impact: [DESCRIBE ANY USER-FACING CHANGES]
During maintenance, the platform will be in read-only mode.
```

### Incident Communication
```
We've identified an issue during maintenance and are rolling back to restore full service.
We expect to be fully operational within [TIME].
We apologize for any inconvenience.
```

### Post-Deployment
```
Database maintenance completed successfully.
All systems are fully operational.
Thank you for your patience.
```

## Documentation References

- [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) - Migration guide
- [SCHEMA_DIAGRAM.md](SCHEMA_DIAGRAM.md) - Entity relationships
- [CI_MIGRATIONS.yaml](CI_MIGRATIONS.yaml) - CI/CD configuration
- Backup procedures: See DevOps documentation
- Disaster recovery plan: See Security documentation

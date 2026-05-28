# Postgres Backup / Restore Runbook

Covers routine backups, point-in-time restore, and the automated drill that runs in CI.

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| `pg_dump` / `pg_restore` / `psql` | 15 | `apt install postgresql-client-15` |
| Bash | 4+ | pre-installed on Linux/macOS |
| Access to `DB_*` env vars | — | see `.env.example` |

Set the following environment variables before running any command (same as `.env.example`):

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=myfans
export DB_PASSWORD=<secret>
export DB_NAME=myfans
```

---

## 1. Take a Backup

```bash
./scripts/pg-backup-restore.sh backup
# → backup_myfans_20260423T164200Z.pgdump

# Custom output path:
./scripts/pg-backup-restore.sh backup /backups/myfans_pre_deploy.pgdump
```

The backup is a **custom-format** (`-Fc`) compressed dump. It is not human-readable but is the most flexible format for selective restore.

**Recommended schedule (production):**

| Frequency | Retention | Storage |
|-----------|-----------|---------|
| Daily full dump | 30 days | Off-site object storage (e.g. S3) |
| WAL archiving (continuous) | 7 days | Same region as DB |

---

## 2. Restore from a Backup

> ⚠️ This overwrites the target database. Always take a fresh backup first.

```bash
# Restore into the same database (drops and recreates all objects):
./scripts/pg-backup-restore.sh restore /backups/myfans_pre_deploy.pgdump
```

The restore uses `--clean --if-exists` so it drops existing objects before recreating them. The database itself must already exist.

**To restore into a fresh database:**

```bash
psql -h $DB_HOST -U $DB_USER -d postgres \
  -c "CREATE DATABASE myfans_restored;"

pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER \
  --no-owner --no-acl \
  -d myfans_restored \
  /backups/myfans_pre_deploy.pgdump
```

---

## 3. Backup / Restore Drill

The drill performs a full cycle — backup → restore into a temporary database → row-count verification — and exits non-zero on any failure.

```bash
./scripts/pg-backup-restore.sh drill
```

Expected output (all tables match):

```
[pg-backup] === Backup/restore drill starting ===
[pg-backup] Step 1/4 — backup source database
[pg-backup]   Backup size: 1.2M
[pg-backup] Step 2/4 — create drill database 'myfans_drill_12345'
[pg-backup] Step 3/4 — restore backup into drill database
[pg-backup] Step 4/4 — verify row counts
[pg-backup]   ✓ notifications: 42 rows
[pg-backup]   ✓ subscriptions: 18 rows
[pg-backup]   ✓ users: 7 rows
[pg-backup]   ...
[pg-backup] === Drill PASSED — backup and restore are consistent ===
```

The drill database is dropped automatically on exit (success or failure).

---

## 4. CI Integration

Add the drill as a CI job that runs against the test Postgres service:

```yaml
# .github/workflows/ci.yml  (add under jobs:)
  db-backup-drill:
    runs-on: ubuntu-latest
    needs: []
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: myfans
          POSTGRES_PASSWORD: myfans
          POSTGRES_DB: myfans
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U myfans"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - name: Install postgres client
        run: sudo apt-get install -y postgresql-client
      - name: Run migrations (seed schema)
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: myfans
          DB_PASSWORD: myfans
          DB_NAME: myfans
        run: cd backend && npx ts-node -r tsconfig-paths/register scripts/run-migrations.ts
      - name: Backup / restore drill
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: myfans
          DB_PASSWORD: myfans
          DB_NAME: myfans
        run: ./scripts/pg-backup-restore.sh drill
```

---

## 5. Pre-deploy Checklist

Before any schema migration or major release:

- [ ] Take a manual backup: `./scripts/pg-backup-restore.sh backup`
- [ ] Record the backup filename and size in the deploy ticket.
- [ ] Confirm the backup file is accessible from the restore host.
- [ ] Run the drill on staging: `./scripts/pg-backup-restore.sh drill`
- [ ] Drill exits 0 — proceed with deploy.
- [ ] Drill exits non-zero — **stop, investigate, do not deploy**.

---

## 6. Restore Decision Tree

```
Production incident detected
        │
        ▼
Is data loss or corruption confirmed?
  No  → investigate application logs first
  Yes ↓
Identify last known-good backup timestamp
        │
        ▼
Take a snapshot of current (corrupted) state
  pg_dump ... -f corrupted_$(date +%s).pgdump
        │
        ▼
Restore from last known-good backup
  ./scripts/pg-backup-restore.sh restore <file>
        │
        ▼
Run migrations to bring schema up to date
  cd backend && npx ts-node ... scripts/run-migrations.ts
        │
        ▼
Verify application health (smoke tests)
        │
        ▼
Document incident and data gap in post-mortem
```

---

## 7. Security Notes

- `DB_PASSWORD` is passed via `PGPASSWORD` (never via command-line arguments).
- Backup files contain all user data — store them encrypted at rest and restrict access.
- Rotate `DB_PASSWORD` after any suspected credential exposure; see `docs/SECRET_MANAGEMENT.md`.
- Never commit `.pgdump` files or `.env` to version control.

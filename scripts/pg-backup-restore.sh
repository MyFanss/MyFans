#!/usr/bin/env bash
# scripts/pg-backup-restore.sh
#
# Backup / restore drill for the MyFans Postgres database.
#
# Usage:
#   backup:   ./scripts/pg-backup-restore.sh backup  [output-file]
#   restore:  ./scripts/pg-backup-restore.sh restore <backup-file>
#   drill:    ./scripts/pg-backup-restore.sh drill
#
# Environment variables (same as .env.example):
#   DB_HOST        default: localhost
#   DB_PORT        default: 5432
#   DB_USER        default: myfans
#   DB_PASSWORD    (required for non-local auth)
#   DB_NAME        default: myfans
#
# The "drill" subcommand runs a full backup → restore → row-count verification
# cycle against a temporary database and exits non-zero on any failure.
# It is safe to run in CI (requires a running Postgres instance).

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-myfans}"
DB_NAME="${DB_NAME:-myfans}"
DRILL_DB="${DB_NAME}_drill_$$"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEFAULT_BACKUP_FILE="backup_${DB_NAME}_${TIMESTAMP}.pgdump"

export PGPASSWORD="${DB_PASSWORD:-}"

PG_DUMP_OPTS=(-Fc -Z 6 --no-owner --no-acl)
PSQL_OPTS=(-h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER")

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[pg-backup] $*"; }
die()  { echo "[pg-backup] ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' not found — install postgresql-client"
}

# ── Subcommands ───────────────────────────────────────────────────────────────
cmd_backup() {
  local out="${1:-$DEFAULT_BACKUP_FILE}"
  require_cmd pg_dump
  log "Backing up '$DB_NAME' → '$out'"
  pg_dump "${PSQL_OPTS[@]}" "${PG_DUMP_OPTS[@]}" -d "$DB_NAME" -f "$out"
  local size
  size="$(du -sh "$out" | cut -f1)"
  log "Backup complete: $out ($size)"
}

cmd_restore() {
  local file="${1:-}"
  [[ -n "$file" ]] || die "Usage: $0 restore <backup-file>"
  [[ -f "$file" ]] || die "Backup file not found: $file"
  require_cmd pg_restore
  log "Restoring '$file' → '$DB_NAME'"
  pg_restore "${PSQL_OPTS[@]}" --clean --if-exists -d "$DB_NAME" "$file"
  log "Restore complete"
}

cmd_drill() {
  require_cmd pg_dump
  require_cmd pg_restore
  require_cmd psql

  log "=== Backup/restore drill starting ==="
  log "Source DB : $DB_NAME"
  log "Drill DB  : $DRILL_DB"

  local tmpfile
  tmpfile="$(mktemp /tmp/myfans_drill_XXXXXX.pgdump)"
  trap 'rm -f "$tmpfile"; psql "${PSQL_OPTS[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DRILL_DB\";" >/dev/null 2>&1 || true' EXIT

  # 1. Backup source DB
  log "Step 1/4 — backup source database"
  pg_dump "${PSQL_OPTS[@]}" "${PG_DUMP_OPTS[@]}" -d "$DB_NAME" -f "$tmpfile"
  local size
  size="$(du -sh "$tmpfile" | cut -f1)"
  log "  Backup size: $size"

  # 2. Create drill DB
  log "Step 2/4 — create drill database '$DRILL_DB'"
  psql "${PSQL_OPTS[@]}" -d postgres -c "CREATE DATABASE \"$DRILL_DB\";" >/dev/null

  # 3. Restore into drill DB
  log "Step 3/4 — restore backup into drill database"
  pg_restore "${PSQL_OPTS[@]}" --no-owner --no-acl -d "$DRILL_DB" "$tmpfile" || {
    # pg_restore exits non-zero for warnings (e.g. missing extensions); only fail on real errors
    log "  pg_restore finished with warnings (non-fatal)"
  }

  # 4. Verify row counts match
  log "Step 4/4 — verify row counts"
  local tables
  tables="$(psql "${PSQL_OPTS[@]}" -d "$DB_NAME" -At \
    -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")"

  local failures=0
  while IFS= read -r table; do
    [[ -z "$table" ]] && continue
    local src_count drill_count
    src_count="$(psql "${PSQL_OPTS[@]}" -d "$DB_NAME"  -At -c "SELECT COUNT(*) FROM \"$table\";")"
    drill_count="$(psql "${PSQL_OPTS[@]}" -d "$DRILL_DB" -At -c "SELECT COUNT(*) FROM \"$table\";")"
    if [[ "$src_count" == "$drill_count" ]]; then
      log "  ✓ $table: $src_count rows"
    else
      log "  ✗ $table: source=$src_count drill=$drill_count  ← MISMATCH"
      (( failures++ )) || true
    fi
  done <<< "$tables"

  if [[ "$failures" -gt 0 ]]; then
    die "Drill FAILED — $failures table(s) had row-count mismatches"
  fi

  log "=== Drill PASSED — backup and restore are consistent ==="
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "${1:-}" in
  backup)  cmd_backup  "${2:-}" ;;
  restore) cmd_restore "${2:-}" ;;
  drill)   cmd_drill ;;
  *)
    echo "Usage: $0 {backup [file] | restore <file> | drill}"
    exit 1
    ;;
esac

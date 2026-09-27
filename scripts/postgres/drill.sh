#!/usr/bin/env bash
# MyFans — Postgres backup/restore drill (issue #1855).
#
# Seeds a scratch database, backs it up with backup.sh, restores it into a
# second scratch database with restore.sh, compares row counts, and proves that
# corrupt and tampered backups are rejected. Used by the CI drill workflow and
# runnable locally against any disposable Postgres server.
#
# Environment:
#   PGHOST / PGPORT / PGUSER / PGPASSWORD   Disposable server (NEVER production)
#   DRILL_SOURCE_DB   default: drill_source
#   DRILL_TARGET_DB   default: drill_restore
#   DRILL_WORKDIR     default: a new temp dir
#   DRILL_REPORT      Optional markdown file to append results to
#
# Exit non-zero on any failed assertion.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DB="${DRILL_SOURCE_DB:-drill_source}"
DST_DB="${DRILL_TARGET_DB:-drill_restore}"
WORK="${DRILL_WORKDIR:-$(mktemp -d "${TMPDIR:-/tmp}/myfans-drill.XXXXXX")}"
REPORT="${DRILL_REPORT:-}"

log() { echo "[pg-drill] $*" >&2; }
fail() { log "FAIL: $*"; exit 1; }
report() { [[ -n "$REPORT" ]] && echo "$*" >>"$REPORT"; return 0; }

for db in "$SRC_DB" "$DST_DB"; do
  case "$db" in
    myfans|postgres|*prod*) fail "Drill database name '$db' looks like a real database; refusing" ;;
  esac
done

mkdir -p "$WORK"
chmod 700 "$WORK"

psql_admin() { psql -XAtq -v ON_ERROR_STOP=1 --dbname postgres "$@"; }
counts() {
  psql -XAtq -v ON_ERROR_STOP=1 --dbname "$1" -c \
    "select 'subscriptions=' || count(*) from subscriptions
     union all select 'plans=' || count(*) from plans
     union all select 'indexer_cursor=' || coalesce(max(last_ledger), 0) from indexer_cursor
     union all select 'content_access_cache=' || count(*) from content_access_cache"
}

log "Resetting scratch databases $SRC_DB and $DST_DB"
psql_admin -c "drop database if exists \"$SRC_DB\"" -c "drop database if exists \"$DST_DB\""
psql_admin -c "create database \"$SRC_DB\"" -c "create database \"$DST_DB\""
psql -XAtq -v ON_ERROR_STOP=1 --dbname "$SRC_DB" -f "$HERE/drill-seed.sql"

# Throwaway passphrase: generated per run, never persisted outside WORK.
passfile="$WORK/passphrase"
head -c 48 /dev/urandom | base64 >"$passfile"
chmod 600 "$passfile"

log "Backup"
t0="$(date -u +%s)"
artifact="$(PGDATABASE="$SRC_DB" BACKUP_DIR="$WORK/backups" BACKUP_ENCRYPTION=gpg \
  BACKUP_PASSPHRASE_FILE="$passfile" BACKUP_LABEL=drill "$HERE/backup.sh")"
t1="$(date -u +%s)"
manifest="${artifact%.dump.gpg}.manifest.json"
[[ -f "$artifact" && -f "$manifest" ]] || fail "backup.sh did not produce artifact + manifest"
grep -q '"encryption": "gpg"' "$manifest" || fail "Manifest does not record gpg encryption"
[[ "$(sed -n 's/.*"dump_sha256": "\(.*\)".*/\1/p' "$manifest")" != "$(sed -n 's/.*"artifact_sha256": "\(.*\)".*/\1/p' "$manifest")" ]] \
  || fail "Artifact is identical to the plaintext dump; encryption did not run"

log "Restore"
PGDATABASE="$DST_DB" BACKUP_PASSPHRASE_FILE="$passfile" "$HERE/restore.sh" "$artifact" "$manifest"
t2="$(date -u +%s)"

src_counts="$(counts "$SRC_DB")"
dst_counts="$(counts "$DST_DB")"
[[ "$src_counts" == "$dst_counts" ]] || fail "Row counts differ after restore:
source:
$src_counts
restored:
$dst_counts"
log "Row counts match"

log "Negative: restore into a non-empty target without --force must be refused"
set +e
PGDATABASE="$DST_DB" BACKUP_PASSPHRASE_FILE="$passfile" "$HERE/restore.sh" "$artifact" "$manifest" 2>/dev/null
rc=$?
set -e
[[ $rc -eq 4 ]] || fail "Expected exit 4 for non-empty target, got $rc"

log "Negative: truncated artifact must be rejected"
truncated="$WORK/truncated.dump.gpg"
head -c "$(( $(wc -c <"$artifact") / 2 ))" "$artifact" >"$truncated"
set +e
BACKUP_PASSPHRASE_FILE="$passfile" "$HERE/restore.sh" --verify-only "$truncated" "$manifest" 2>/dev/null
rc=$?
set -e
[[ $rc -eq 3 ]] || fail "Expected exit 3 for truncated artifact, got $rc"

log "Negative: wrong key must be rejected"
wrongpass="$WORK/wrong-passphrase"
echo "not-the-key" >"$wrongpass"
set +e
BACKUP_PASSPHRASE_FILE="$wrongpass" "$HERE/restore.sh" --verify-only "$artifact" "$manifest" 2>/dev/null
rc=$?
set -e
[[ $rc -eq 3 ]] || fail "Expected exit 3 for wrong key, got $rc"

log "Drill passed: backup ${t0}->${t1} ($((t1 - t0))s), restore $((t2 - t1))s"
report "## Postgres restore drill"
report ""
report "| Step | Result |"
report "|---|---|"
report "| Backup (encrypted, checksummed) | ok, $((t1 - t0))s |"
report "| Restore into empty DB | ok, $((t2 - t1))s |"
report "| Row counts match | ok |"
report "| Non-empty target refused | ok |"
report "| Truncated artifact rejected | ok |"
report "| Wrong key rejected | ok |"
report ""
report "Measured restore time is for the synthetic seed only; see RTO notes in docs/POSTGRES_BACKUP_RESTORE.md."

if [[ -z "${DRILL_WORKDIR:-}" ]]; then
  rm -rf "$WORK"
fi
psql_admin -c "drop database if exists \"$SRC_DB\"" -c "drop database if exists \"$DST_DB\""

#!/usr/bin/env bash
# MyFans — logical Postgres backup (issue #1855).
#
# Produces an encrypted, checksummed pg_dump custom-format archive plus a JSON
# manifest. See docs/POSTGRES_BACKUP_RESTORE.md for the schedule, retention,
# and restore procedure.
#
# Connection: standard libpq env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD,
# PGDATABASE) or DATABASE_URL. Never pass the password on the command line.
#
# Environment:
#   DATABASE_URL                 Optional; overrides PG* vars when set.
#   BACKUP_DIR                   Output directory (default: ./backups)
#   BACKUP_ENCRYPTION            gpg | age | none (default: gpg)
#   BACKUP_PASSPHRASE_FILE       gpg: file containing the symmetric passphrase
#   BACKUP_AGE_RECIPIENT         age: public key (age1...) to encrypt to
#   ALLOW_UNENCRYPTED            Must be "1" to use BACKUP_ENCRYPTION=none
#   RETAIN_DAYS                  Delete local backups older than N days (default: unset = keep)
#   BACKUP_LABEL                 Filename prefix (default: myfans)
#
# Exit codes: 0 ok, 1 usage/config error, 2 dump failed, 3 verification failed.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_ENCRYPTION="${BACKUP_ENCRYPTION:-gpg}"
BACKUP_LABEL="${BACKUP_LABEL:-myfans}"

log() { echo "[pg-backup] $*" >&2; }
die() { log "ERROR: $*"; exit "${2:-1}"; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

file_size() { wc -c <"$1" | tr -d ' '; }

command -v pg_dump >/dev/null || die "pg_dump not found"
command -v pg_restore >/dev/null || die "pg_restore not found"

conn_args=()
if [[ -n "${DATABASE_URL:-}" ]]; then
  conn_args=(--dbname "$DATABASE_URL")
fi

case "$BACKUP_ENCRYPTION" in
  gpg)
    command -v gpg >/dev/null || die "gpg not found"
    [[ -n "${BACKUP_PASSPHRASE_FILE:-}" && -r "${BACKUP_PASSPHRASE_FILE}" ]] \
      || die "BACKUP_PASSPHRASE_FILE must point to a readable file when BACKUP_ENCRYPTION=gpg"
    ;;
  age)
    command -v age >/dev/null || die "age not found"
    [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]] || die "BACKUP_AGE_RECIPIENT is required when BACKUP_ENCRYPTION=age"
    ;;
  none)
    [[ "${ALLOW_UNENCRYPTED:-}" == "1" ]] \
      || die "Refusing to write an unencrypted backup; set ALLOW_UNENCRYPTED=1 for local drills only"
    ;;
  *) die "Unknown BACKUP_ENCRYPTION: $BACKUP_ENCRYPTION" ;;
esac

umask 077
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
base="$BACKUP_DIR/${BACKUP_LABEL}-${stamp}"
dump="$base.dump"

started="$(date -u +%s)"
log "Dumping to $dump"
if ! pg_dump ${conn_args[@]+"${conn_args[@]}"} --format=custom --compress=6 --no-owner --no-privileges --file "$dump"; then
  rm -f "$dump"
  die "pg_dump failed" 2
fi

# A readable table of contents is the cheapest proof the archive is not truncated.
if ! pg_restore --list "$dump" >/dev/null; then
  rm -f "$dump"
  die "pg_restore --list could not read the fresh archive" 3
fi

plain_sha="$(sha256 "$dump")"
plain_size="$(file_size "$dump")"

case "$BACKUP_ENCRYPTION" in
  gpg)
    out="$dump.gpg"
    gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
      --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
      --output "$out" "$dump"
    rm -f "$dump"
    ;;
  age)
    out="$dump.age"
    age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$out" "$dump"
    rm -f "$dump"
    ;;
  none)
    out="$dump"
    ;;
esac

finished="$(date -u +%s)"
manifest="$base.manifest.json"
cat >"$manifest" <<JSON
{
  "file": "$(basename "$out")",
  "created_at": "$stamp",
  "encryption": "$BACKUP_ENCRYPTION",
  "format": "pg_dump custom",
  "pg_dump_version": "$(pg_dump --version | sed 's/"/\\"/g')",
  "dump_sha256": "$plain_sha",
  "dump_bytes": $plain_size,
  "artifact_sha256": "$(sha256 "$out")",
  "artifact_bytes": $(file_size "$out"),
  "duration_seconds": $((finished - started))
}
JSON

log "Wrote $out"
log "Wrote $manifest"

if [[ -n "${RETAIN_DAYS:-}" ]]; then
  [[ "$RETAIN_DAYS" =~ ^[0-9]+$ ]] || die "RETAIN_DAYS must be an integer"
  log "Pruning local backups older than $RETAIN_DAYS days in $BACKUP_DIR"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${BACKUP_LABEL}-*" -mtime "+$RETAIN_DAYS" -print -delete >&2
fi

# Print the artifact path on stdout so callers can pipe it into an upload step.
echo "$out"

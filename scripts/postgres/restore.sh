#!/usr/bin/env bash
# MyFans — verify and restore a logical Postgres backup (issue #1855).
#
# Usage:
#   scripts/postgres/restore.sh [--verify-only] [--force] <artifact> [manifest]
#
#   <artifact>   myfans-<stamp>.dump[.gpg|.age] produced by backup.sh
#   [manifest]   defaults to <artifact without .dump...>.manifest.json
#
# Target: standard libpq env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD,
# PGDATABASE) or RESTORE_DATABASE_URL. The target database must already exist.
#
# Environment:
#   RESTORE_DATABASE_URL     Optional; overrides PG* vars for the restore target.
#   BACKUP_PASSPHRASE_FILE   gpg artifacts
#   BACKUP_AGE_IDENTITY      age artifacts: path to the private identity file
#   RESTORE_JOBS             pg_restore --jobs (default: 4)
#
# Safety: refuses to restore into a database that already contains tables in
# the public schema unless --force is given. Never point this at production
# without following the decision tree in docs/POSTGRES_BACKUP_RESTORE.md.
#
# Exit codes: 0 ok, 1 usage/config, 3 corrupt/unverifiable backup,
#             4 target not empty, 5 pg_restore failed.

set -euo pipefail

VERIFY_ONLY=0
FORCE=0
RESTORE_JOBS="${RESTORE_JOBS:-4}"

log() { echo "[pg-restore] $*" >&2; }
die() { log "ERROR: $*"; exit "${2:-1}"; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

# Minimal JSON string/number field reader for the flat manifest backup.sh writes.
manifest_field() {
  sed -n "s/^[[:space:]]*\"$2\":[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}[[:space:]]*$/\1/p" "$1" | head -n1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-only) VERIFY_ONLY=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    --) shift; break ;;
    -*) die "Unknown option: $1" ;;
    *) break ;;
  esac
done

[[ $# -ge 1 ]] || die "Usage: $0 [--verify-only] [--force] <artifact> [manifest]"
artifact="$1"
[[ -f "$artifact" ]] || die "Artifact not found: $artifact"

stem="${artifact%.gpg}"
stem="${stem%.age}"
stem="${stem%.dump}"
manifest="${2:-$stem.manifest.json}"
[[ -f "$manifest" ]] || die "Manifest not found: $manifest (a backup without a manifest cannot be verified)" 3

command -v pg_restore >/dev/null || die "pg_restore not found"

work="$(mktemp -d "${TMPDIR:-/tmp}/myfans-restore.XXXXXX")"
chmod 700 "$work"
trap 'rm -rf "$work"' EXIT

# 1. Ciphertext checksum — catches truncated or bit-rotted uploads before decrypting.
expected_artifact_sha="$(manifest_field "$manifest" artifact_sha256)"
actual_artifact_sha="$(sha256 "$artifact")"
if [[ -z "$expected_artifact_sha" || "$expected_artifact_sha" != "$actual_artifact_sha" ]]; then
  die "Artifact checksum mismatch (expected ${expected_artifact_sha:-<missing>}, got $actual_artifact_sha)" 3
fi
log "Artifact checksum OK"

# 2. Decrypt.
dump="$work/restore.dump"
case "$artifact" in
  *.gpg)
    [[ -n "${BACKUP_PASSPHRASE_FILE:-}" && -r "${BACKUP_PASSPHRASE_FILE}" ]] \
      || die "BACKUP_PASSPHRASE_FILE is required for .gpg artifacts"
    gpg --batch --quiet --decrypt --pinentry-mode loopback \
      --passphrase-file "$BACKUP_PASSPHRASE_FILE" --output "$dump" "$artifact" \
      || die "Decryption failed (wrong key or corrupt artifact)" 3
    ;;
  *.age)
    [[ -n "${BACKUP_AGE_IDENTITY:-}" && -r "${BACKUP_AGE_IDENTITY}" ]] \
      || die "BACKUP_AGE_IDENTITY is required for .age artifacts"
    age --decrypt --identity "$BACKUP_AGE_IDENTITY" --output "$dump" "$artifact" \
      || die "Decryption failed (wrong key or corrupt artifact)" 3
    ;;
  *.dump)
    cp "$artifact" "$dump"
    ;;
  *) die "Unrecognised artifact extension: $artifact" ;;
esac

# 3. Plaintext checksum + readable table of contents.
expected_dump_sha="$(manifest_field "$manifest" dump_sha256)"
actual_dump_sha="$(sha256 "$dump")"
if [[ -z "$expected_dump_sha" || "$expected_dump_sha" != "$actual_dump_sha" ]]; then
  die "Decrypted dump checksum mismatch (expected ${expected_dump_sha:-<missing>}, got $actual_dump_sha)" 3
fi
pg_restore --list "$dump" >"$work/toc.txt" 2>"$work/toc.err" \
  || { cat "$work/toc.err" >&2; die "pg_restore cannot read the archive table of contents" 3; }
log "Dump checksum OK; archive lists $(grep -cv '^;' "$work/toc.txt") TOC entries"

if [[ "$VERIFY_ONLY" == "1" ]]; then
  log "Verify-only: backup is readable. No restore performed."
  exit 0
fi

# 4. Restore into the target.
command -v psql >/dev/null || die "psql not found"
conn_args=()
if [[ -n "${RESTORE_DATABASE_URL:-}" ]]; then
  conn_args=(--dbname "$RESTORE_DATABASE_URL")
fi

existing="$(psql ${conn_args[@]+"${conn_args[@]}"} -XAtq -v ON_ERROR_STOP=1 \
  -c "select count(*) from information_schema.tables where table_schema = 'public'")"
if [[ "$existing" != "0" && "$FORCE" != "1" ]]; then
  die "Target database already has $existing public tables; re-run with --force only if overwriting is intended" 4
fi

started="$(date -u +%s)"
restore_flags=(--no-owner --no-privileges --exit-on-error --jobs "$RESTORE_JOBS")
if [[ "$FORCE" == "1" ]]; then
  restore_flags+=(--clean --if-exists)
fi
# pg_restore uses --dbname for the target; PG* env vars are honoured otherwise.
if [[ ${#conn_args[@]} -gt 0 ]]; then
  pg_restore "${restore_flags[@]}" ${conn_args[@]+"${conn_args[@]}"} "$dump" || die "pg_restore failed" 5
else
  pg_restore "${restore_flags[@]}" --dbname "${PGDATABASE:?PGDATABASE or RESTORE_DATABASE_URL is required}" "$dump" \
    || die "pg_restore failed" 5
fi
finished="$(date -u +%s)"

log "Restore finished in $((finished - started))s. Row counts (public schema):"
psql ${conn_args[@]+"${conn_args[@]}"} -XAtq -v ON_ERROR_STOP=1 -F $'\t' <<'SQL' >&2
select c.relname, (xpath('/row/n/text()',
         query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
SQL

#!/usr/bin/env bash
# Generate ABI snapshots for all workspace contracts.
#
# Usage:
#   ./scripts/snapshot-abi.sh            # regenerate snapshots in place
#   ./scripts/snapshot-abi.sh --check    # diff against committed snapshots (CI mode)
#
# To intentionally update snapshots after a breaking change:
#   1. Run without --check to regenerate.
#   2. Commit the updated snapshot files with a message that includes
#      "abi-update: <reason>" so the change is traceable in git history.
#   3. Open a PR — reviewers will see the exact ABI diff in the file changes.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_DIR="$ROOT_DIR/abi-snapshots"
CHECK_MODE=false

for arg in "$@"; do
  [[ "$arg" == "--check" ]] && CHECK_MODE=true
done

PACKAGES=(
  myfans-token
  creator-registry
  creator-deposits
  creator-earnings
  subscription
  content-access
  content-likes
  earnings
  treasury
)

if ! command -v stellar >/dev/null 2>&1; then
  echo "stellar CLI is required. Install: cargo install --locked stellar-cli" >&2
  exit 1
fi

echo "[abi] building contracts (wasm release)"
cargo build --workspace --target wasm32-unknown-unknown --release \
  --manifest-path "$ROOT_DIR/Cargo.toml" -q

mkdir -p "$SNAPSHOT_DIR"

FAILED=0

for pkg in "${PACKAGES[@]}"; do
  wasm_name="${pkg//-/_}.wasm"
  wasm_path="$(find "$ROOT_DIR/target" -type f -path "*/release/$wasm_name" -print -quit)"

  if [[ -z "$wasm_path" ]]; then
    echo "[abi] WARN: wasm not found for '$pkg', skipping" >&2
    continue
  fi

  snapshot_file="$SNAPSHOT_DIR/${pkg}.json"

  # stellar contract inspect emits the contract spec (XDR) as JSON
  fresh="$(stellar contract inspect --wasm "$wasm_path" --output json 2>/dev/null)"

  if [[ "$CHECK_MODE" == true ]]; then
    if [[ ! -f "$snapshot_file" ]]; then
      echo "[abi] FAIL: snapshot missing for '$pkg'. Run snapshot-abi.sh and commit." >&2
      FAILED=1
      continue
    fi

    committed="$(cat "$snapshot_file")"
    if [[ "$fresh" != "$committed" ]]; then
      echo "[abi] FAIL: ABI changed for '$pkg'." >&2
      echo "      To update intentionally: run ./scripts/snapshot-abi.sh, commit with" >&2
      echo "      message containing 'abi-update: <reason>', and open a PR." >&2
      diff <(echo "$committed") <(echo "$fresh") >&2 || true
      FAILED=1
    else
      echo "[abi] ok: $pkg"
    fi
  else
    echo "$fresh" > "$snapshot_file"
    echo "[abi] wrote $snapshot_file"
  fi
done

if [[ "$CHECK_MODE" == true && "$FAILED" -ne 0 ]]; then
  echo "[abi] One or more ABI snapshots are out of date. See diffs above." >&2
  exit 1
fi

[[ "$CHECK_MODE" == true ]] && echo "[abi] All snapshots match."

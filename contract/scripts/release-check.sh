#!/usr/bin/env bash
# contract/scripts/release-check.sh
#
# Runs every automated step from docs/release/contract-release-checklist.md.
# Exits non-zero on the first failure so CI surfaces the exact failing step.
#
# Usage:
#   ./scripts/release-check.sh              # full check (default)
#   ./scripts/release-check.sh --skip-abi  # skip ABI snapshot check (e.g. first run)
#   ./scripts/release-check.sh --skip-dry-run  # skip deploy dry-run (no stellar CLI)
#
# Environment variables:
#   RELEASE_CHECK_NETWORK   Network for dry-run (default: futurenet)
#   RELEASE_CHECK_SOURCE    Source identity for dry-run (default: myfans-deployer)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$ROOT_DIR/scripts"

SKIP_ABI=false
SKIP_DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-abi)      SKIP_ABI=true ;;
    --skip-dry-run)  SKIP_DRY_RUN=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--skip-abi] [--skip-dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

NETWORK="${RELEASE_CHECK_NETWORK:-futurenet}"
SOURCE="${RELEASE_CHECK_SOURCE:-myfans-deployer}"

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS=0
FAIL=0
STEPS=()

step_ok()   { echo "[release-check] ✓ $1"; STEPS+=("PASS: $1"); (( PASS++ )) || true; }
step_fail() { echo "[release-check] ✗ $1" >&2; STEPS+=("FAIL: $1"); (( FAIL++ )) || true; }

run_step() {
  local label="$1"
  shift
  echo "[release-check] running: $label"
  if "$@"; then
    step_ok "$label"
  else
    step_fail "$label"
    return 1
  fi
}

# ── Step 1: Rust formatting ───────────────────────────────────────────────────

run_step "cargo fmt --check" \
  cargo fmt --check --manifest-path "$ROOT_DIR/Cargo.toml"

# Pin is documented in contract/CHANGELOG.md; update this grep when bumping Soroban.
run_step "workspace soroban-sdk pin (Cargo.toml)" \
  bash -c 'grep -qxF "soroban-sdk = \"21.7.7\"" "'"$ROOT_DIR"'/Cargo.toml"'

# ── Step 2: Clippy ────────────────────────────────────────────────────────────

run_step "cargo clippy" \
  cargo clippy --all-targets --all-features --manifest-path "$ROOT_DIR/Cargo.toml" \
    -- -D warnings

# ── Step 3: Tests ─────────────────────────────────────────────────────────────

run_step "cargo test" \
  cargo test --all-features --manifest-path "$ROOT_DIR/Cargo.toml"

# ── Step 4: Interface docs drift check ────────────────────────────────────────

run_step "interface docs drift check" \
  node "$SCRIPT_DIR/check-interface-docs-drift.mjs"

# ── Step 5: WASM release build ────────────────────────────────────────────────

run_step "cargo build --release (wasm32)" \
  cargo build --release --target wasm32-unknown-unknown \
    --manifest-path "$ROOT_DIR/Cargo.toml"

# ── Step 6: ABI snapshot check ────────────────────────────────────────────────

if [[ "$SKIP_ABI" == true ]]; then
  echo "[release-check] skipping ABI snapshot check (--skip-abi)"
elif ! command -v stellar >/dev/null 2>&1; then
  echo "[release-check] stellar CLI not found — skipping ABI snapshot check"
else
  run_step "ABI snapshots current" \
    bash "$SCRIPT_DIR/snapshot-abi.sh" --check
fi

# ── Step 7: Deploy dry-run ────────────────────────────────────────────────────

if [[ "$SKIP_DRY_RUN" == true ]]; then
  echo "[release-check] skipping deploy dry-run (--skip-dry-run)"
elif ! command -v stellar >/dev/null 2>&1; then
  echo "[release-check] stellar CLI not found — skipping deploy dry-run"
else
  run_step "deploy dry-run (--network $NETWORK)" \
    bash "$SCRIPT_DIR/deploy.sh" \
      --network "$NETWORK" \
      --source "$SOURCE" \
      --dry-run
fi

# ── Step 8: Deploy output schema check (if deployed.json exists) ──────────────

DEPLOYED_JSON="$ROOT_DIR/deployed.json"
if [[ -f "$DEPLOYED_JSON" ]]; then
  run_step "deployed.json schema version" \
    bash "$SCRIPT_DIR/test-deploy-output.sh" "$DEPLOYED_JSON"
else
  echo "[release-check] deployed.json not found — skipping schema check (expected before first deploy)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "[release-check] ─────────────────────────────────────────"
echo "[release-check] Results: ${PASS} passed, ${FAIL} failed"
for s in "${STEPS[@]}"; do
  echo "[release-check]   $s"
done
echo "[release-check] ─────────────────────────────────────────"

if [[ "$FAIL" -gt 0 ]]; then
  echo "[release-check] FAILED — fix the steps above before releasing." >&2
  exit 1
fi

echo "[release-check] All automated release checks passed."

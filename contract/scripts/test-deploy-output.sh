#!/usr/bin/env bash
# Validates contract IDs in deploy output (deployed*.json) or contract-ids.json.
#
# Fails closed when any required ID is missing, empty, or malformed, or when
# the file's "network" does not match EXPECTED_NETWORK. Release smoke must not
# pass with a green run that hides broken releases or strands frontend env.
# Validation logic lives in validate-contract-ids.mjs (Issue #1848).
#
# Usage:
#   test-deploy-output.sh [FILE] [--require-schema-version]
#
# Environment:
#   EXPECTED_NETWORK=testnet     require the file's "network" to match
#   SKIP_CONTRACT_ID_CHECK=1     skip ID validation (fork PR marker only; see
#                                .github/workflows/futurenet-smoke.yml)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FILE="contract/deployed.json"
EXTRA_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --require-schema-version) EXTRA_ARGS+=("$arg") ;;
    -*) echo "Unknown argument: $arg" >&2; exit 2 ;;
    *) FILE="$arg" ;;
  esac
done

if [[ ! -f "$FILE" ]]; then
  echo "Error: File $FILE not found." >&2
  exit 1
fi

if [[ "${SKIP_CONTRACT_ID_CHECK:-}" == "1" ]]; then
  echo "SKIP_CONTRACT_ID_CHECK=1 set; skipping contract ID validation (fork PR marker)."
  exit 0
fi

exec node "$SCRIPT_DIR/validate-contract-ids.mjs" --file="$FILE" ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}

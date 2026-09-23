#!/usr/bin/env bash
# Verification script for schema version and contract IDs in deployment output.
set -euo pipefail

FILE="${1:-contract/deployed.json}"

if [[ ! -f "$FILE" ]]; then
  echo "Error: File $FILE not found." >&2
  exit 1
fi

echo "Checking $FILE for schemaVersion..."
if grep -q "\"schemaVersion\":" "$FILE"; then
  VERSION=$(grep "\"schemaVersion\":" "$FILE" | sed -E 's/.*"schemaVersion": "([^"]+)".*/\1/')
  echo "Found schemaVersion: $VERSION"
else
  echo "Error: schemaVersion not found in $FILE" >&2
  exit 1
fi

# Fail closed when contract IDs are empty or missing. Release smoke must not
# pass with a green run that hides broken releases or strands frontend env.
# Fork PRs may skip this check only with an explicit marker (see workflow).
if [[ "${SKIP_CONTRACT_ID_CHECK:-}" == "1" ]]; then
  echo "SKIP_CONTRACT_ID_CHECK=1 set; skipping contract ID validation (fork PR marker)."
  exit 0
fi

echo "Checking $FILE for non-empty contract IDs..."
if ! grep -q "\"contractIds\":" "$FILE"; then
  echo "Error: contractIds not found in $FILE" >&2
  exit 1
fi

# Extract the contractIds object and verify each entry has a non-empty value.
IDS=$(sed -n 's/.*"contractIds"[[:space:]]*:[[:space:]]*{\([^}]*\)}.*/\1/p' "$FILE")
if [[ -z "$IDS" ]]; then
  echo "Error: contractIds is empty in $FILE" >&2
  exit 1
fi

MISSING=0
while IFS= read -r entry; do
  [[ -z "$entry" ]] && continue
  key=$(echo "$entry" | sed -E 's/^[[:space:]]*"([^"]+)"[[:space:]]*:.*/\1/')
  val=$(echo "$entry" | sed -E 's/^[[:space:]]*"[^"]+"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')
  if [[ -z "$val" ]]; then
    echo "Error: contract ID '$key' is empty in $FILE" >&2
    MISSING=1
  else
    echo "  $key = $val"
  fi
done < <(echo "$IDS" | tr ',' '\n')

if [[ "$MISSING" -ne 0 ]]; then
  echo "Error: one or more contract IDs are empty in $FILE" >&2
  exit 1
fi

echo "All contract IDs present and non-empty."
exit 0

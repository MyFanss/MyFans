#!/usr/bin/env bash
# Verification script for schema version in deployment output.
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
  exit 0
else
  echo "Error: schemaVersion not found in $FILE" >&2
  exit 1
fi

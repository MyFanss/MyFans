#!/bin/bash
# Validate that cache configuration is properly set up
# This script checks that all necessary dependency files exist
# for CI caching to work correctly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

ERRORS=0
WARNINGS=0

echo "🔍 Validating CI cache configuration..."
echo ""

# Check backend
echo "📦 Backend (Node.js/npm):"
if [[ -f "$ROOT_DIR/backend/package-lock.json" ]]; then
  echo "  ✅ backend/package-lock.json exists"
else
  echo "  ❌ backend/package-lock.json NOT found"
  ((ERRORS++))
fi

if [[ -f "$ROOT_DIR/backend/package.json" ]]; then
  echo "  ✅ backend/package.json exists"
else
  echo "  ❌ backend/package.json NOT found"
  ((ERRORS++))
fi

# Check frontend
echo "📦 Frontend (Node.js/npm):"
if [[ -f "$ROOT_DIR/frontend/package-lock.json" ]]; then
  echo "  ✅ frontend/package-lock.json exists"
else
  echo "  ❌ frontend/package-lock.json NOT found"
  ((ERRORS++))
fi

if [[ -f "$ROOT_DIR/frontend/package.json" ]]; then
  echo "  ✅ frontend/package.json exists"
else
  echo "  ❌ frontend/package.json NOT found"
  ((ERRORS++))
fi

# Check contract
echo "🦀 Contract (Rust/Cargo):"
if [[ -f "$ROOT_DIR/contract/Cargo.lock" ]]; then
  echo "  ✅ contract/Cargo.lock exists"
else
  echo "  ❌ contract/Cargo.lock NOT found"
  ((ERRORS++))
fi

if [[ -f "$ROOT_DIR/contract/Cargo.toml" ]]; then
  echo "  ✅ contract/Cargo.toml exists"
else
  echo "  ❌ contract/Cargo.toml NOT found"
  ((ERRORS++))
fi

# Verify CI workflow files reference caching
echo ""
echo "🔧 CI Workflow Cache Configuration:"

check_workflow_cache() {
  local workflow_file="$1"
  local name="$2"
  
  if [[ -f "$workflow_file" ]]; then
    if grep -q "cache:" "$workflow_file" || grep -q "Swatinem/rust-cache" "$workflow_file"; then
      echo "  ✅ $name has cache configuration"
    else
      echo "  ⚠️  $name may be missing cache configuration"
      ((WARNINGS++))
    fi
  else
    echo "  ⚠️  $name not found"
    ((WARNINGS++))
  fi
}

check_workflow_cache "$ROOT_DIR/.github/workflows/ci.yml" "ci.yml"
check_workflow_cache "$ROOT_DIR/.github/workflows/backend-ci.yml" "backend-ci.yml"
check_workflow_cache "$ROOT_DIR/.github/workflows/frontend-ci.yml" "frontend-ci.yml"
check_workflow_cache "$ROOT_DIR/.github/workflows/contract-ci.yml" "contract-ci.yml"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $ERRORS -eq 0 ]]; then
  echo "✅ All cache dependencies are properly configured!"
  exit 0
else
  echo "❌ Found $ERRORS error(s) and $WARNINGS warning(s)"
  exit 1
fi

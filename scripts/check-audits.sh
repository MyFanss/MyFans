#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configurable thresholds
CRITICAL_THRESHOLD=0
HIGH_THRESHOLD=0
MODERATE_THRESHOLD=10
WARN_THRESHOLD=10

# Parse command-line options
AUDIT_IGNORE_FILE=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --ignore-file)
      AUDIT_IGNORE_FILE="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${BLUE}🔍 Running security audit checks (npm & cargo)...${NC}\n"

# Track overall status
FAILED=0
WARNED=0
declare -A AUDIT_RESULTS

# Function to check if an advisory is in the ignore list
is_advisory_ignored() {
  local advisory_id=$1
  local ignore_file=$2
  
  if [ -z "$ignore_file" ] || [ ! -f "$ignore_file" ]; then
    return 1
  fi
  
  # Check if advisory ID is in the ignore file (lines starting with advisory ID)
  grep -q "^$advisory_id" "$ignore_file" 2>/dev/null || return 1
  return 0
}

# Check backend npm audit
check_npm_backend() {
  echo -e "${YELLOW}📦 Checking backend/ npm audit...${NC}"
  cd "$REPO_ROOT/backend" || return 1

  AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"critical":0,"high":0,"moderate":0}},"vulnerabilities":{}}')
  CRITICAL=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.critical // 0')
  HIGH=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.high // 0')
  MODERATE=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.moderate // 0')
  LOW=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.low // 0')

  echo "  📊 Results:"
  echo "     🔴 Critical:  $CRITICAL"
  echo "     🟠 High:      $HIGH"
  echo "     🟡 Moderate:  $MODERATE"
  echo "     🟢 Low:       $LOW"

  AUDIT_RESULTS["backend_critical"]=$CRITICAL
  AUDIT_RESULTS["backend_high"]=$HIGH
  AUDIT_RESULTS["backend_moderate"]=$MODERATE

  if (( CRITICAL > CRITICAL_THRESHOLD )); then
    echo -e "   ${RED}❌ CRITICAL: $CRITICAL vulnerabilities exceed threshold${NC}"
    FAILED=1
  fi

  if (( HIGH > HIGH_THRESHOLD )); then
    echo -e "   ${RED}❌ HIGH: $HIGH vulnerabilities exceed threshold${NC}"
    FAILED=1
  fi

  if (( MODERATE > MODERATE_THRESHOLD )); then
    echo -e "   ${YELLOW}⚠️  MODERATE: $MODERATE vulnerabilities${NC}"
  fi
  
  if [ "$VERBOSE" = true ] && (( CRITICAL > 0 || HIGH > 0 )); then
    echo "   📋 Vulnerable packages:"
    echo "$AUDIT_OUTPUT" | jq '.vulnerabilities | to_entries[] | select(.value.severity=="critical" or .value.severity=="high") | "\(.key): \(.value.severity)"' 2>/dev/null | head -10
  fi

  echo ""
}

# Check frontend npm audit
check_npm_frontend() {
  echo -e "${YELLOW}📦 Checking frontend/ npm audit...${NC}"
  cd "$REPO_ROOT/frontend" || return 1

  AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"critical":0,"high":0,"moderate":0}},"vulnerabilities":{}}')
  CRITICAL=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.critical // 0')
  HIGH=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.high // 0')
  MODERATE=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.moderate // 0')
  LOW=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.low // 0')

  echo "  📊 Results:"
  echo "     🔴 Critical:  $CRITICAL"
  echo "     🟠 High:      $HIGH"
  echo "     🟡 Moderate:  $MODERATE"
  echo "     🟢 Low:       $LOW"

  AUDIT_RESULTS["frontend_critical"]=$CRITICAL
  AUDIT_RESULTS["frontend_high"]=$HIGH
  AUDIT_RESULTS["frontend_moderate"]=$MODERATE

  if (( CRITICAL > CRITICAL_THRESHOLD )); then
    echo -e "   ${RED}❌ CRITICAL: $CRITICAL vulnerabilities exceed threshold${NC}"
    FAILED=1
  fi

  if (( HIGH > HIGH_THRESHOLD )); then
    echo -e "   ${RED}❌ HIGH: $HIGH vulnerabilities exceed threshold${NC}"
    FAILED=1
  fi

  if (( MODERATE > MODERATE_THRESHOLD )); then
    echo -e "   ${YELLOW}⚠️  MODERATE: $MODERATE vulnerabilities${NC}"
  fi
  
  if [ "$VERBOSE" = true ] && (( CRITICAL > 0 || HIGH > 0 )); then
    echo "   📋 Vulnerable packages:"
    echo "$AUDIT_OUTPUT" | jq '.vulnerabilities | to_entries[] | select(.value.severity=="critical" or .value.severity=="high") | "\(.key): \(.value.severity)"' 2>/dev/null | head -10
  fi

  echo ""
}

# Check cargo audit (contract)
check_cargo_audit() {
  if [ ! -d "$REPO_ROOT/contract" ] || [ ! -f "$REPO_ROOT/contract/Cargo.toml" ]; then
    return 0
  fi

  echo -e "${YELLOW}📦 Checking contract/ cargo audit...${NC}"
  cd "$REPO_ROOT/contract" || return 1

  # Check if cargo-audit is installed
  if ! command -v cargo-audit &> /dev/null; then
    echo "   Installing cargo-audit..."
    if ! cargo install cargo-audit --quiet 2>/dev/null; then
      echo -e "   ${YELLOW}⚠️  Could not install cargo-audit, skipping${NC}\n"
      return 0
    fi
  fi

  CARGO_AUDIT=$(cargo audit --json 2>/dev/null || echo '{"vulnerabilities":[]}')
  CARGO_CRITICAL=$(echo "$CARGO_AUDIT" | jq '[.vulnerabilities[] | select(.severity=="critical")] | length' 2>/dev/null || echo "0")
  CARGO_HIGH=$(echo "$CARGO_AUDIT" | jq '[.vulnerabilities[] | select(.severity=="high")] | length' 2>/dev/null || echo "0")
  CARGO_TOTAL=$(echo "$CARGO_AUDIT" | jq '.vulnerabilities | length' 2>/dev/null || echo "0")

  echo "  📊 Results:"
  echo "     🔴 Critical:  $CARGO_CRITICAL"
  echo "     🟠 High:      $CARGO_HIGH"
  echo "     📈 Total:     $CARGO_TOTAL"

  AUDIT_RESULTS["contract_critical"]=$CARGO_CRITICAL
  AUDIT_RESULTS["contract_high"]=$CARGO_HIGH
  AUDIT_RESULTS["contract_total"]=$CARGO_TOTAL

  if (( CARGO_CRITICAL > CRITICAL_THRESHOLD )); then
    echo -e "   ${RED}❌ CRITICAL: $CARGO_CRITICAL vulnerabilities exceed threshold${NC}"
    FAILED=1
  fi

  if (( CARGO_HIGH > HIGH_THRESHOLD )); then
    echo -e "   ${RED}❌ HIGH: $CARGO_HIGH vulnerabilities exceed threshold${NC}"
    FAILED=1
  fi
  
  if [ "$VERBOSE" = true ] && (( CARGO_TOTAL > 0 )); then
    echo "   📋 Vulnerabilities:"
    echo "$CARGO_AUDIT" | jq '.vulnerabilities[] | {advisory, severity, versions}' 2>/dev/null | head -20
  fi

  echo ""
}

# Run all checks
check_npm_backend
check_npm_frontend
check_cargo_audit

# Print summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Audit Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
for key in "${!AUDIT_RESULTS[@]}"; do
  echo "  ${key}: ${AUDIT_RESULTS[$key]}"
done

echo ""
if [ $FAILED -eq 1 ]; then
  echo -e "${RED}❌ Audit check FAILED - Critical or high severity vulnerabilities detected${NC}"
  echo -e "${YELLOW}💡 To document exceptions, add them to an audit ignore file.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Audit check PASSED${NC}"
  exit 0
fi

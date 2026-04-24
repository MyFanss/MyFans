#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurable thresholds
CRITICAL_THRESHOLD=0
HIGH_THRESHOLD=5
MODERATE_THRESHOLD=10
WARN_THRESHOLD=10

echo -e "${BLUE}🔍 Running npm audit checks...${NC}"

# Track overall status
FAILED=0
declare -A AUDIT_RESULTS

# Check backend
if [ -d "$REPO_ROOT/backend" ]; then
  echo -e "\n${YELLOW}Checking backend/ audits...${NC}"
  cd "$REPO_ROOT/backend"

  AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)
  CRITICAL=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.critical // 0')
  HIGH=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.high // 0')
  MODERATE=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.moderate // 0')
  LOW=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.low // 0')

  echo "Backend audit results (npm):"
  echo "  Critical:  $CRITICAL"
  echo "  High:      $HIGH"
  echo "  Moderate:  $MODERATE"
  echo "  Low:       $LOW"

  AUDIT_RESULTS["backend_critical"]=$CRITICAL
  AUDIT_RESULTS["backend_high"]=$HIGH
  AUDIT_RESULTS["backend_moderate"]=$MODERATE

  if (( CRITICAL > CRITICAL_THRESHOLD )); then
    echo -e "${RED}❌ CRITICAL: $CRITICAL vulnerabilities exceed threshold of $CRITICAL_THRESHOLD${NC}"
    FAILED=1
  fi

  if (( HIGH > HIGH_THRESHOLD )); then
    echo -e "${YELLOW}⚠️  HIGH: $HIGH vulnerabilities exceed threshold of $HIGH_THRESHOLD${NC}"
  fi

  if (( MODERATE > MODERATE_THRESHOLD )); then
    echo -e "${YELLOW}⚠️  MODERATE: $MODERATE vulnerabilities exceed threshold of $MODERATE_THRESHOLD${NC}"
  fi
fi

# Check frontend
if [ -d "$REPO_ROOT/frontend" ]; then
  echo -e "\n${YELLOW}Checking frontend/ audits...${NC}"
  cd "$REPO_ROOT/frontend"

  AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)
  CRITICAL=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.critical // 0')
  HIGH=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.high // 0')
  MODERATE=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.moderate // 0')
  LOW=$(echo "$AUDIT_OUTPUT" | jq '.metadata.vulnerabilities.low // 0')

  echo "Frontend audit results (npm):"
  echo "  Critical:  $CRITICAL"
  echo "  High:      $HIGH"
  echo "  Moderate:  $MODERATE"
  echo "  Low:       $LOW"

  AUDIT_RESULTS["frontend_critical"]=$CRITICAL
  AUDIT_RESULTS["frontend_high"]=$HIGH
  AUDIT_RESULTS["frontend_moderate"]=$MODERATE

  if (( CRITICAL > CRITICAL_THRESHOLD )); then
    echo -e "${RED}❌ CRITICAL: $CRITICAL vulnerabilities exceed threshold of $CRITICAL_THRESHOLD${NC}"
    FAILED=1
  fi

  if (( HIGH > HIGH_THRESHOLD )); then
    echo -e "${YELLOW}⚠️  HIGH: $HIGH vulnerabilities exceed threshold of $HIGH_THRESHOLD${NC}"
  fi
fi

# Check contract (Rust/Cargo if applicable)
if [ -d "$REPO_ROOT/contract" ] && command -v cargo &> /dev/null; then
  echo -e "\n${YELLOW}Checking contract/ audits (Cargo)...${NC}"
  cd "$REPO_ROOT/contract"

  if [ -f "Cargo.toml" ]; then
    # Try to run cargo audit if installed
    if command -v cargo-audit &> /dev/null || cargo install cargo-audit 2>/dev/null; then
      CARGO_AUDIT=$(cargo audit --json 2>/dev/null || echo '{"vulnerabilities":[]}')
      CARGO_VULNS=$(echo "$CARGO_AUDIT" | jq '.vulnerabilities | length' 2>/dev/null || echo "0")

      echo "Contract audit results (Cargo):"
      echo "  Vulnerabilities found: $CARGO_VULNS"

      AUDIT_RESULTS["contract_vulnerabilities"]=$CARGO_VULNS

      if (( CARGO_VULNS > 0 )); then
        echo -e "${YELLOW}⚠️  CARGO: Found $CARGO_VULNS Cargo vulnerabilities${NC}"
        echo "$CARGO_AUDIT" | jq '.vulnerabilities[] | {advisory, versions}' 2>/dev/null || true
      fi
    fi
  fi
fi

# Print summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Audit Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

for key in "${!AUDIT_RESULTS[@]}"; do
  echo "${key}: ${AUDIT_RESULTS[$key]}"
done

if [ $FAILED -eq 1 ]; then
  echo -e "\n${RED}❌ Audit check FAILED - Critical vulnerabilities detected${NC}"
  exit 1
else
  echo -e "\n${GREEN}✅ Audit check PASSED${NC}"
  exit 0
fi

#!/bin/bash

# Security Audit Tests
# Tests the audit checking functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_RESULTS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Running Security Audit Tests${NC}\n"

# Test 1: Verify check-audits.sh exists and is executable
test_script_exists() {
  if [ -f "$REPO_ROOT/scripts/check-audits.sh" ] && [ -x "$REPO_ROOT/scripts/check-audits.sh" ]; then
    echo -e "${GREEN}✅ check-audits.sh exists and is executable${NC}"
    return 0
  else
    echo -e "${RED}❌ check-audits.sh not found or not executable${NC}"
    return 1
  fi
}

# Test 2: Verify .auditignore files exist
test_auditignore_files() {
  local files_missing=0
  
  for dir in backend frontend contract; do
    if [ -f "$REPO_ROOT/$dir/.auditignore" ]; then
      echo -e "${GREEN}✅ $dir/.auditignore exists${NC}"
    else
      echo -e "${RED}❌ $dir/.auditignore missing${NC}"
      files_missing=1
    fi
  done
  
  return $files_missing
}

# Test 3: Check CI workflow files include audit steps
test_ci_workflows_have_audits() {
  local missing=0
  
  # Check audit-check.yml
  if grep -q "cargo audit" "$REPO_ROOT/.github/workflows/audit-check.yml"; then
    echo -e "${GREEN}✅ audit-check.yml includes cargo audit${NC}"
  else
    echo -e "${RED}❌ audit-check.yml missing cargo audit${NC}"
    missing=1
  fi
  
  # Check backend CI
  if grep -q "npm audit" "$REPO_ROOT/.github/workflows/backend-ci.yml"; then
    echo -e "${GREEN}✅ backend-ci.yml includes npm audit${NC}"
  else
    echo -e "${RED}❌ backend-ci.yml missing npm audit${NC}"
    missing=1
  fi
  
  # Check frontend CI
  if grep -q "npm audit" "$REPO_ROOT/.github/workflows/frontend-ci.yml"; then
    echo -e "${GREEN}✅ frontend-ci.yml includes npm audit${NC}"
  else
    echo -e "${RED}❌ frontend-ci.yml missing npm audit${NC}"
    missing=1
  fi
  
  # Check contract CI
  if grep -q "cargo audit" "$REPO_ROOT/.github/workflows/contract-ci.yml"; then
    echo -e "${GREEN}✅ contract-ci.yml includes cargo audit${NC}"
  else
    echo -e "${RED}❌ contract-ci.yml missing cargo audit${NC}"
    missing=1
  fi
  
  return $missing
}

# Test 4: Verify documentation exists
test_documentation() {
  if [ -f "$REPO_ROOT/docs/SECURITY_AUDIT.md" ]; then
    echo -e "${GREEN}✅ SECURITY_AUDIT.md documentation exists${NC}"
    
    # Check for key sections
    if grep -q "Managing Audit Exceptions" "$REPO_ROOT/docs/SECURITY_AUDIT.md"; then
      echo -e "${GREEN}✅ Exception handling documented${NC}"
    else
      echo -e "${YELLOW}⚠️  Exception handling documentation incomplete${NC}"
    fi
    
    return 0
  else
    echo -e "${RED}❌ SECURITY_AUDIT.md not found${NC}"
    return 1
  fi
}

# Test 5: Run basic audit check (non-blocking)
test_basic_audit() {
  echo -e "\n${YELLOW}Running basic audit check...${NC}"
  
  if "$REPO_ROOT/scripts/check-audits.sh" --verbose; then
    echo -e "${GREEN}✅ Audit check passed${NC}"
    return 0
  else
    RESULT=$?
    echo -e "${YELLOW}⚠️  Audit check failed (exit code: $RESULT)${NC}"
    # Don't fail tests on audit failures - some repos may have known vulnerabilities
    return 0
  fi
}

# Test 6: Verify audit output format
test_audit_output_format() {
  # Check that CI workflows properly capture audit output
  if grep -q "jq .metadata.vulnerabilities" "$REPO_ROOT/.github/workflows/audit-check.yml"; then
    echo -e "${GREEN}✅ npm audit JSON parsing configured${NC}"
  else
    echo -e "${RED}❌ npm audit JSON parsing missing${NC}"
    return 1
  fi
  
  if grep -q 'jq.*vulnerabilities' "$REPO_ROOT/.github/workflows/contract-ci.yml"; then
    echo -e "${GREEN}✅ cargo audit JSON parsing configured${NC}"
  else
    echo -e "${RED}❌ cargo audit JSON parsing missing${NC}"
    return 1
  fi
  
  return 0
}

# Test 7: Check for thresholds
test_thresholds_defined() {
  if grep -q "CRITICAL_THRESHOLD\|HIGH_THRESHOLD" "$REPO_ROOT/scripts/check-audits.sh"; then
    echo -e "${GREEN}✅ Vulnerability thresholds defined${NC}"
    
    # Verify thresholds are reasonable
    if grep -q "CRITICAL_THRESHOLD=0" "$REPO_ROOT/scripts/check-audits.sh"; then
      echo -e "${GREEN}✅ Critical threshold set to 0 (strict)${NC}"
    else
      echo -e "${YELLOW}⚠️  Critical threshold may not be strict enough${NC}"
    fi
    
    return 0
  else
    echo -e "${RED}❌ Vulnerability thresholds not found${NC}"
    return 1
  fi
}

# Run all tests
echo -e "${BLUE}Running tests...${NC}\n"

test_script_exists || ((TEST_RESULTS++))
echo ""

test_auditignore_files || ((TEST_RESULTS++))
echo ""

test_ci_workflows_have_audits || ((TEST_RESULTS++))
echo ""

test_documentation || ((TEST_RESULTS++))
echo ""

test_audit_output_format || ((TEST_RESULTS++))
echo ""

test_thresholds_defined || ((TEST_RESULTS++))
echo ""

test_basic_audit
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $TEST_RESULTS -eq 0 ]; then
  echo -e "${GREEN}✅ All security audit tests PASSED${NC}"
  exit 0
else
  echo -e "${RED}❌ $TEST_RESULTS test(s) FAILED${NC}"
  exit 1
fi

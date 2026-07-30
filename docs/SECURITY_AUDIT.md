# Security Audit Configuration

This document describes how security auditing works in the CI/CD pipeline and how to manage audit exceptions.

## Overview

The project runs three types of security audits:

1. **npm audit** - For backend and frontend JavaScript/TypeScript dependencies
2. **cargo audit** - For contract Rust dependencies
3. **All audits** - Run in CI on every PR and push; also available locally

## CI Workflows

### Audit Check Workflow

The `audit-check.yml` workflow runs on every PR and push to `main`/`develop`, plus weekly on Sunday.

**Triggers:**
- Pull requests
- Pushes to main/develop
- Weekly schedule (Sunday 00:00 UTC)

**What it checks:**
- Backend npm dependencies
- Frontend npm dependencies
- Contract cargo dependencies

**Behavior:**
- **CRITICAL vulnerabilities**: ❌ Fail the build
- **HIGH vulnerabilities**: ❌ Fail the build
- **MODERATE/LOW vulnerabilities**: ⚠️ Warn only

### Individual CI Workflows

Each subsystem also includes audit checks:

- **backend-ci.yml**: Runs `npm audit` after build, fails on HIGH/CRITICAL
- **frontend-ci.yml**: Runs `npm audit` after build, fails on HIGH/CRITICAL
- **contract-ci.yml**: Runs `cargo audit` after build, fails on CRITICAL, warns on HIGH

## Local Testing

Run audit checks locally before committing:

```bash
./scripts/check-audits.sh
```

### Options

```bash
# Verbose output showing vulnerable packages
./scripts/check-audits.sh --verbose

# Use custom audit ignore file
./scripts/check-audits.sh --ignore-file path/to/exceptions.txt

# Combined
./scripts/check-audits.sh --verbose --ignore-file backend/.auditignore
```

## Managing Audit Exceptions

Sometimes you need to temporarily acknowledge vulnerabilities while working on fixes. Exceptions should be **documented and time-limited**.

### Creating an Audit Exceptions File

Create a `.auditignore` or `audit-exceptions.txt` file in the relevant directory:

**Format:**
```
# Comment: Reason for exception (JIRA ticket, deadline, etc.)
# Format: ADVISORY_ID [OPTIONAL: Description]

# Backend exceptions
NPM-XXXX: Waiting for package maintainer fix (ETA: 2024-06-01)
NPM-YYYY: Using workaround in code
```

**For Cargo:**
```
# Format: RUSTSEC-YYYY-ZZZZ [Reason]
RUSTSEC-2024-0001: False positive, not applicable to our use case
```

### Backend Exceptions

**File:** `backend/.auditignore`

```bash
# Example
NPM-1234: Downstream dependency issue, maintainer working on fix
NPM-5678: Using deprecated package, migration planned for v2
```

### Frontend Exceptions

**File:** `frontend/.auditignore`

```bash
# Example
NPM-9999: Known issue in optional dev dependency
```

### Contract (Cargo) Exceptions

**File:** `contract/.auditignore`

```bash
# Example
RUSTSEC-2024-0001: Test-only dependency, not in production
```

## Thresholds

Current thresholds (can be adjusted):

| Severity | npm audit (frontend/backend) | cargo audit (contract) | Action |
|----------|------------------------------|----------------------|--------|
| Critical | Fail (0 allowed) | Fail (0 allowed) | ❌ Block merge |
| High | Fail (0 allowed) | Warn (0 allowed) | ❌ Block merge |
| Moderate | Warn | N/A | ⚠️ Visible but allowed |
| Low | Warn | N/A | ⚠️ Visible but allowed |

## Fixing Vulnerabilities

### Strategy

1. **Identify** the vulnerable package with `npm audit` or `cargo audit`
2. **Assess** the risk - does it affect your code path?
3. **Fix** by updating the package: `npm update [package]` or `cargo update`
4. **Verify** the fix: Run audits again
5. **Test** application behavior to ensure the update doesn't break anything

### npm Audit Fix

```bash
cd backend
npm audit fix           # Auto-fix all
npm audit fix --force   # Override peer dependency conflicts (use carefully!)
npm update [package]    # Update specific package
```

### Cargo Audit

```bash
cd contract
cargo update            # Update all dependencies to latest compatible versions
cargo update -p [crate] # Update specific crate
```

## Documenting High/Critical Findings

When a HIGH or CRITICAL vulnerability cannot be fixed immediately:

1. **Create an exception** in the `.auditignore` file
2. **Document in CHANGELOG.md** under a "Security" section
3. **Create a tracking issue** in GitHub (link in the exception comment)
4. **Set a deadline** for resolution
5. **Review weekly** during security reviews

### Example Exception Entry

```bash
# GITHUB-ISSUE-#523: Remote Code Execution in upstream package
# Waiting for patch release. Maintainer ETA: 2024-06-15
# Risk: Currently only triggered in development environment
# Action: Prioritize after release
NPM-6789: Upstream RCE in dev dependency (Dev env only, ETA 2024-06-15)
```

## Audit Reports in PRs

The `audit-check.yml` workflow automatically comments on PRs with:
- Summary of vulnerabilities by severity
- Links to detailed reports
- Guidance on running local audits

Example PR comment:
```
## 🔐 Security Audit Summary

**Backend (npm):**
- 🔴 Critical: 0
- 🟠 High: 0

**Frontend (npm):**
- 🔴 Critical: 1
- 🟠 High: 2

**Contract (Cargo):**
- 🔴 Critical: 0
- 🟠 High: 0

Run locally with: `./scripts/check-audits.sh --verbose`
```

## Best Practices

1. **Never ignore CRITICAL or HIGH** vulnerabilities without good reason
2. **Document all exceptions** with the reason and deadline
3. **Review exceptions quarterly** and remove outdated ones
4. **Run audits weekly** (enabled by default in schedule)
5. **Treat audit failures like test failures** - fix before merging
6. **Keep dependencies updated** proactively
7. **Monitor upstream advisories** for your critical dependencies

## Troubleshooting

### "npm audit fix" breaks peer dependencies

Use with caution - peer dependencies may be critical for compatibility:
```bash
npm audit fix --legacy-peer-deps  # If needed
```

### cargo-audit not found

Install it manually:
```bash
cargo install cargo-audit
cargo audit
```

### Audit gives different results locally vs CI

Ensure you're on the same versions:
```bash
npm ci                    # Use lockfile
cargo clean && cargo audit # Fresh Cargo build
```

## Related Documents

- [Dependency Review Policy](../CONTRIBUTING.md#dependencies)
- [Release Checklist](../docs/release/CHECKLIST.md)
- [Vulnerability Reporting](../SECURITY.md)


# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in MyFans, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email security@myfans.platform with details
3. Include steps to reproduce, impact assessment, and suggested fixes if available
4. Allow 48 hours for initial response

## Security Response Process

1. **Acknowledgment**: Within 48 hours
2. **Assessment**: Within 5 business days
3. **Fix Development**: Timeline communicated after assessment
4. **Disclosure**: Coordinated disclosure after fix is deployed

## Penetration Testing Findings Tracker

### Current Security Status

| Component | Last Tested | Status | Critical Issues | High Issues | Medium Issues |
|-----------|-------------|--------|-----------------|-------------|---------------|
| Frontend  | -           | Pending | 0              | 0           | 0             |
| Backend   | 2026-07-25  | Reviewed | 0            | 0           | 3             |
| Contracts | -           | Pending | 0              | 0           | 0             |

### Findings Log

#### Template
```
### Finding #[ID] - [Severity] - [Date Found]
**Component**: [Frontend/Backend/Contract]
**Category**: [e.g., XSS, SQL Injection, Access Control]
**Description**: [Brief description]
**Impact**: [Potential impact]
**Status**: [Open/In Progress/Resolved/Accepted Risk]
**Assigned To**: [Team member]
**Resolution**: [How it was fixed or why accepted]
**Resolved Date**: [Date]
```

---

### Active Findings

```
### Finding #6 - Low - 2026-07-25
**Component**: Backend
**Category**: Dead Code / Attack Surface
**Description**: Deprecated duplicate auth stacks (`src/auth`, `src/refresh-module`,
  `src/users-module`) remain in the tree alongside the canonical `src/auth-module` +
  `src/users` stack, each with their own JWT signing/expiry configuration
  (`backend/src/auth-module/auth.module.ts` vs `backend/src/users/users.module.ts`).
  They are not wired into `AppModule` (see the comment at the top of
  `backend/src/app.module.ts`), so they are not reachable at runtime today.
**Impact**: Divergent, largely untested duplicate auth code increases the chance
  that a future refactor or module-wiring change accidentally reintroduces one of
  these stacks (or a bypass) into the request path.
**Status**: Open
**Assigned To**: Backend team
**Resolution**: Pending — delete the deprecated modules once call sites are confirmed
  fully migrated to `auth-module`.
**Resolved Date**: -
```

---

### Resolved Findings

```
### Finding #1 - Medium - 2026-07-25
**Component**: Backend
**Category**: Access Control / Observability (shallow liveness)
**Description**: `HealthService.getHealth()` (`backend/src/health/health.service.ts`)
  always returned a static `up` without probing the database or any other
  subsystem, and it was the only liveness/readiness signal exposed.
**Impact**: An orchestrator (k8s liveness/readiness probe, load balancer health
  check) polling `GET /health` would see a healthy instance even when its database
  connection was completely down, keeping traffic routed to a non-functional pod
  instead of failing over.
**Status**: Resolved
**Assigned To**: Backend team
**Resolution**: Added `GET /v1/health/ready`, which probes the database
  (mandatory — 503 on failure) and Soroban RPC (optional, reported only).
  `GET /v1/health` remains a pure liveness check by design (see issue #1443).
**Resolved Date**: 2026-07-25

### Finding #2 - Medium - 2026-07-25
**Component**: Backend
**Category**: CI/CD Gap
**Description**: CI (`.github/workflows/ci.yml`) ran only the unit test suite
  (`npm test`) on PRs. The e2e suite — which includes the access-control and
  transport-security regression tests in `backend/test/rbac.e2e-spec.ts`,
  `cors-security.e2e-spec.ts`, and `security-hardening.e2e-spec.ts` — was never
  executed automatically.
**Impact**: A regression in RBAC enforcement, CORS policy, or other
  security-hardening behavior covered only by e2e tests could be merged to `main`
  without CI catching it.
**Status**: Resolved
**Assigned To**: Backend team
**Resolution**: Added a `Backend E2E` job with a Postgres service to
  `.github/workflows/ci.yml`, running `npm run test:e2e` on every PR; local run
  steps documented in `DEVELOPMENT.md` (see issue #1444).
**Resolved Date**: 2026-07-25

### Finding #3 - Low - 2026-07-25
**Component**: Backend
**Category**: Process
**Description**: This `SECURITY.md` findings tracker existed only as an empty
  template despite known, addressable exposures already present in the backend.
**Impact**: Prior and ongoing security work was not discoverable from the
  document meant to track it, undermining the audit trail for reviewers.
**Status**: Resolved
**Assigned To**: Backend team
**Resolution**: Populated with the findings in this section (see issue #1445).
**Resolved Date**: 2026-07-25

### Finding #4 - Medium - 2026-07-25
**Component**: Backend
**Category**: Access Control (missing authorization boundary)
**Description**: The frontend expects creator-scoped `/earnings/*` endpoints,
  but the only server-side aggregation was `AnalyticsController`
  (`GET /v1/analytics/*`), which is shared between admins and creators, gated
  by a manual `scopeToOwner` check, and was not even registered in `AppModule`.
**Impact**: Without a dedicated, strictly-scoped earnings surface, there was
  pressure to either bypass the backend for financial data or hand-roll a new
  endpoint without the existing admin/creator scoping discipline.
**Status**: Resolved
**Assigned To**: Backend team
**Resolution**: Added `EarningsModule` (`backend/src/earnings/`), gated by
  `@Roles(UserRole.CREATOR)` with every query always scoped to
  `req.user.userId` — no cross-creator or admin override path exists on this
  controller (see issue #1438).
**Resolved Date**: 2026-07-25
```

---

### Accepted Risks

```
### Finding #5 - Low - 2026-07-25
**Component**: Backend
**Category**: Data Exposure (credentials in transit)
**Description**: The Redis health probe (`pingRedis` in
  `backend/src/health/health.service.ts`) sends `AUTH <password>` in the clear
  when `REDIS_URL` uses the non-TLS `redis://` scheme instead of `rediss://`.
**Impact**: On a network segment an attacker can observe, the Redis credential
  used for the health check could be captured.
**Status**: Accepted Risk
**Assigned To**: Backend team
**Resolution**: Accepted — the probe only runs over the internal
  Docker/VPC network in current deployments. Recommend switching to `rediss://`
  in any environment where that network boundary is not trusted.
**Resolved Date**: -
```

---

### Accepted Risks

*No accepted risks at this time*

---

## Security Best Practices

### For Developers

#### Frontend
- Sanitize all user inputs
- Use Content Security Policy (CSP)
- Implement proper CORS policies
- Avoid storing sensitive data in localStorage
- Use HTTPS only
- Implement rate limiting on API calls

#### Backend
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Implement proper authentication and authorization
- Use environment variables for secrets
- Enable CORS selectively
- Implement rate limiting
- Log security events
- Keep dependencies updated

#### Smart Contracts
- Follow Soroban security best practices
- Implement access controls
- Validate all inputs
- Use safe math operations
- Test edge cases thoroughly
- Conduct security audits before mainnet deployment
- Implement upgrade governance (see CONTRACT_UPGRADE_GOVERNANCE.md)

## Security Checklist for PRs

- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] Authentication/authorization checks in place
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up to date and have no known vulnerabilities
- [ ] Security-sensitive changes reviewed by security team

## Dependency Security

Run security audits regularly:

```bash
# Frontend
cd frontend && npm audit

# Backend
cd backend && npm audit

# Contracts
cd contract && cargo audit
```

## Incident Response

In case of a security incident:

1. **Contain**: Immediately isolate affected systems
2. **Assess**: Determine scope and impact
3. **Notify**: Alert security team and stakeholders
4. **Remediate**: Deploy fixes
5. **Document**: Record incident details and response
6. **Review**: Conduct post-mortem and update procedures

## Security Contacts

- **Security Team**: security@myfans.platform
- **Emergency Contact**: emergency@myfans.platform (24/7)

## Compliance

MyFans adheres to:
- OWASP Top 10 security guidelines
- Soroban smart contract security best practices
- Industry-standard encryption protocols (TLS 1.3+)

## Security Updates

This document is reviewed and updated quarterly or after significant security events.

**Last Updated**: 2026-07-25

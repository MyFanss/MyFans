# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues by:

1. **GitHub Security Advisories (preferred)**: Open a private advisory at  
   `https://github.com/MyFanss/MyFans/security/advisories/new`
2. **Email**: [realjaiboi70@gmail.com](mailto:realjaiboi70@gmail.com)

We aim to acknowledge reports within **48 hours** and will provide a timeline for
a fix.  We request that you do not disclose the issue publicly until a fix has been
released or we have communicated a remediation plan.

---

## Scope

| Area | In scope |
|------|----------|
| Backend (NestJS API, auth, subscriptions, content) | ✅ Yes |
| Frontend (Next.js UI, wallet integration) | ✅ Yes |
| Soroban smart contracts (subscription lifecycle, access control) | ✅ Yes |
| Stellar / Soroban RPC infrastructure | ❌ No — report to Stellar Foundation |
| Third-party IPFS infrastructure | ❌ No — report to the relevant provider |

---

## Security Findings Tracker

The table below tracks all named security findings from internal reviews and
penetration tests.  "Resolved" means the fix has been merged to `main` and the
finding's criteria are fully met.

| Finding | Title | Status | Resolved in / Notes |
|---------|-------|--------|----------------------|
| #1 | Static health endpoint did not probe dependencies | **Resolved** | `GET /v1/health/ready` added (PR #1620). Probes DB (mandatory) and Redis (mandatory); Soroban RPC visibility-only. |
| #6 | Duplicate authentication stacks | **Resolved** | Deprecated `src/auth`, `src/users-module`, `src/refresh-module` removed. Canonical stack is `backend/src/auth-module` + `backend/src/users`. Global throttler and migration history preserved. |
| #7 | No audit trail for admin role changes / moderation actions | **Resolved** | Append-only `admin_audit_events` table added (`backend/src/admin-audit`). Logs actor, action, target, SHA-256 payload hash, correlation ID, timestamp. Readable via `GET /v1/admin/audit-log` (admin-only). |

### Contract penetration test

| Area | Status | Notes |
|------|--------|-------|
| Soroban subscription contract | **Pending** | No third-party pen-test has been performed yet.  Internal unit and integration tests exist (`contract/` test suite) but do not substitute for an external security review.  A formal audit is planned before mainnet deployment.  Until then, treat the contract as **unaudited**. |
| Frontend wallet integration | **Pending** | No formal pen-test.  Freighter is the reference wallet; Lobstr and WalletConnect paths have had less real-world exercise.  Planned alongside the contract audit. |

> **Note**: "Pending" rows are honest — they are not marked Resolved until a real
> external review has been completed and findings addressed.

---

## Security SLA

| Severity | Acknowledgement | Fix target |
|----------|----------------|------------|
| Critical | 24 hours | 72 hours |
| High | 48 hours | 1 week |
| Medium | 48 hours | 2 weeks |
| Low | 48 hours | Next release |

---

## Security best practices in this repo

- **Auth**: JWT sessions via `backend/src/auth-module`; challenge-based Stellar
  key authentication.  See [`backend/docs/AUTH_MODES.md`](backend/docs/AUTH_MODES.md).
- **CSRF**: Double-submit cookie pattern for all mutating requests.  Frontend enforces
  via `getCsrfToken()` / `invalidateCsrfToken()` in `frontend/src/lib/csrf.ts`.
- **CORS**: Per-environment allow-list.  See
  [`backend/docs/CORS_AND_SECURITY_HEADERS.md`](backend/docs/CORS_AND_SECURITY_HEADERS.md).
- **Rate limiting**: Global and per-route throttling; see
  [`backend/docs/RATE_LIMITING.md`](backend/docs/RATE_LIMITING.md).
- **Secrets**: Rotation runbooks in [`backend/docs/SECRET_MANAGEMENT.md`](backend/docs/SECRET_MANAGEMENT.md).
- **Audit log**: Every admin role change and moderation decision is written to
  `admin_audit_events` (append-only, no delete endpoint).
- **Error envelopes**: Correlation IDs are included in error responses outside
  production only; never shown to end-users as raw values.
- **Contract IDs**: Never logged or exposed in CI output; stored as GitHub Actions
  secrets and masked automatically.

# Security findings

## Dependency audit policy

High and critical vulnerabilities in npm packages (backend + frontend) and
Rust crates (contract) **block PRs**. The audit runs on every pull request,
every push to `main`, and weekly (Monday 08:00 UTC) via
`.github/workflows/security-audit.yml`.

- **npm audit** (`--audit-level=high --omit=dev`): low/moderate advisories are
  reported but do not fail CI.
- **cargo audit**: severity threshold and approved exceptions are declared in
  `contract/audit.toml`. Add a new entry there (with a justification comment)
  to document a known-safe advisory.

See [`docs/testing.md`](docs/testing.md) for full CI details.

## Finding #7 — no audit trail for admin role changes / moderation actions (#1568)

**Resolved.** A compromised admin token could previously promote accounts
or approve/reject moderation flags with no durable record. `backend/src/admin-audit`
now provides an append-only `admin_audit_events` table (actor, action, target,
a SHA-256 payload hash, correlation id, timestamp). A row is written on every
role change (`UsersController#updateUserRole`, admin-only) and every
moderation decision (`ModerationService#reviewFlag`). The log is readable via
`GET /v1/admin/audit-log` (admin-only, 403 otherwise, paginated); there is no
update or delete endpoint for audit rows.

## Finding #6 — duplicate authentication stacks

**Resolved.** The canonical runtime stack is `backend/src/auth-module` with
`backend/src/users`. The deprecated `src/auth`, `src/users-module`, and
`src/refresh-module` trees were removed. The global throttler lives under
`src/common/guards`, and historical schema migrations live under
`src/database/migrations`, so deleting deprecated code no longer removes
production controls or migration history.

## Finding #1 — static health endpoint did not probe dependencies (#1620)

**Resolved.** `GET /v1/health` previously reported a static `up` without
probing any subsystem, so an orchestrator (k8s liveness/readiness probe, load
balancer health check) could keep routing traffic to an instance whose
database connection was completely down. Liveness (`GET /v1/health`) now stays
a cheap process-up check by design — a dependency outage must not restart an
otherwise-healthy process — and readiness moved to `GET /v1/health/ready`,
which probes the database (mandatory, 503 on failure) and Redis when
configured (mandatory, 503 on failure), while Soroban RPC is probed and
reported for visibility only and never fails readiness on its own.

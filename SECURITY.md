# Security Policy

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately to the maintainers
(e.g. via GitHub Security Advisories or the contact listed in the repository
profile). Do not open a public issue for undisclosed vulnerabilities.

## Trust & Safety / Moderation

The moderation subsystem (issue #1795) provides a report queue, evidence
references, admin actions, and creator notifications. The following security
properties apply:

- **Admin-only enforcement.** All moderation queue and action endpoints are
  restricted to users with the moderation/admin role. RBAC is enforced at the
  API layer; unauthenticated or non-admin callers receive `403`.
- **Evidence access is restricted.** Evidence is referenced by content
  identifier (CID) or storage pointer only. Raw evidence is never exposed in
  public responses; access is limited to authorized moderators and is subject
  to the retention policy below.
- **Audit trail.** Every moderation action (hide content, suspend creator) is
  recorded in an append-only audit log capturing actor, target, action,
  timestamp, and reason. Audit entries are immutable.
- **Creator notification.** Affected creators are notified when moderation
  action is taken against their content or account.
- **Dual control (optional).** For high-impact actions, deployments may enable
  dual-control approval so a single admin cannot unilaterally suspend an
  account.

### Retention policy

Evidence and audit records are retained according to the deployment's
retention policy. Evidence references may be purged once the associated
report is resolved and the retention window has elapsed; audit records are
retained for the configured audit retention period.

## Supported Versions

Security fixes are applied to the latest release on the default branch.

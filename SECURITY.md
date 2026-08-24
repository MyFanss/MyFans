# Security findings

## Finding #6 — duplicate authentication stacks

**Resolved.** The canonical runtime stack is `backend/src/auth-module` with
`backend/src/users`. The deprecated `src/auth`, `src/users-module`, and
`src/refresh-module` trees were removed. The global throttler lives under
`src/common/guards`, and historical schema migrations live under
`src/database/migrations`, so deleting deprecated code no longer removes
production controls or migration history.

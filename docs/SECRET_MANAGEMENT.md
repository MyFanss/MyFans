# Secret Management

This document covers how secrets are handled in the MyFans backend, how to
configure them locally, and how they are managed in CI/CD.

---

## Principle of Least Privilege

- Each service/component only receives the secrets it needs.
- Secrets are never passed as CLI arguments (visible in `ps` output).
- Secrets are never logged — the logger has no secret-masking filter because
  no secret should ever reach a log statement in the first place.

---

## Required Secrets

| Variable | Description | Where used |
|---|---|---|
| `JWT_SECRET` | Signs and verifies JWT access tokens | Auth, Users, Notifications modules |
| `DB_PASSWORD` | PostgreSQL password | TypeORM data source |
| `DB_HOST` | Database host | TypeORM data source |
| `DB_PORT` | Database port | TypeORM data source |
| `DB_USER` | Database user | TypeORM data source |
| `DB_NAME` | Database name | TypeORM data source |

The app performs a startup check (`src/common/secrets-validation.ts`) and
**refuses to start** if any of the above are missing or empty.

---

## Local Development

1. Copy the example file:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Fill in every `REQUIRED` value. Generate a strong JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Never commit `.env` — it is in `.gitignore`.

---

## CI / GitHub Actions

Secrets are stored as [GitHub Encrypted Secrets][gh-secrets] and injected at
runtime. They are never hardcoded in workflow files.

| GitHub Secret | Maps to env var | Used in |
|---|---|---|
| `E2E_JWT_SECRET` | `JWT_SECRET` | `e2e.yml` |
| `E2E_DB_PASSWORD` | `DB_PASSWORD` | `e2e.yml` (falls back to ephemeral postgres password) |

To add or rotate a secret: **Settings → Secrets and variables → Actions → New repository secret**.

---

## Secret Rotation

1. Generate a new value (see generation command above).
2. Update the GitHub Secret (or your secrets manager).
3. Redeploy the backend — the startup check will confirm the new value is present.
4. For `JWT_SECRET` rotation: all existing sessions are invalidated immediately.
   Coordinate with the team before rotating in production.

---

## What is NOT a Secret

These values appear in `.env.example` but are **not** sensitive:

- `SOROBAN_RPC_URL` — public RPC endpoint
- `STELLAR_NETWORK` — network name (`testnet` / `mainnet`)
- `PORT`, `NODE_ENV`, `LOG_LEVEL` — runtime configuration
- `STARTUP_MODE` and probe settings — operational tuning

---

## Audit Trail

- `src/common/secrets-validation.ts` — lists every required secret and
  validates presence at startup.
- `backend/.env.example` — canonical reference for all environment variables.
- This document — human-readable guidance.

[gh-secrets]: https://docs.github.com/en/actions/security-guides/encrypted-secrets

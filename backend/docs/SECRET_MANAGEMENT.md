# Secret Management

This document describes how secrets are stored, validated, and rotated in the MyFans backend.

## Secrets inventory

| Variable | Purpose | Required | Rotation frequency |
|---|---|---|---|
| `JWT_SECRET` | Signs and verifies JWT access tokens | Yes | On compromise; recommended every 90 days |
| `DB_PASSWORD` | PostgreSQL authentication | Yes | On compromise; recommended every 90 days |
| `WEBHOOK_SECRET` | HMAC-SHA256 signing of outbound webhooks | Yes | On compromise; recommended every 30 days |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` | Database connection | Yes | When infrastructure changes |
| `SOROBAN_RPC_URL` | Soroban RPC endpoint | Yes | When provider changes |

All required variables are validated at startup via `src/common/secrets-validation.ts`. The app exits immediately if any are missing.

## Storage rules

- **Never** commit `.env` or any file containing real secret values to version control.
- Use `.env.example` as the template; copy it to `.env` locally and fill in values.
- In production, inject secrets via your platform's secret manager (e.g. AWS Secrets Manager, HashiCorp Vault, GitHub Actions secrets) as environment variables.
- Restrict read access to `.env` files: `chmod 600 .env`.

## Rotation runbooks

### JWT_SECRET

Rotating `JWT_SECRET` immediately invalidates all existing sessions. Plan for a brief re-login window.

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update the secret in your secret manager / deployment environment.
3. Redeploy the backend. All existing JWTs are immediately invalid.
4. Notify users that they will need to log in again (or handle gracefully in the frontend).

**Zero-downtime option:** run two instances briefly — old instance with old secret, new instance with new secret — then drain the old instance once sessions expire (default TTL: 24 h).

---

### DB_PASSWORD

1. Create the new password in your database:
   ```sql
   ALTER USER myfans WITH PASSWORD '<new-password>';
   ```
2. Update `DB_PASSWORD` in your secret manager.
3. Redeploy the backend (or restart the process) to pick up the new value.
4. Verify connectivity: `npm run start:prod` should pass the DB startup probe.
5. Remove the old password from any local notes or CI variables.

---

### WEBHOOK_SECRET

The backend supports zero-downtime webhook secret rotation via a grace-period window. The previous secret remains valid for up to 24 hours after rotation so in-flight webhook deliveries are not rejected.

**Using the CLI script:**

```bash
# 1. Rotate to a new secret (previous secret valid for 24 h by default)
API_BASE_URL=https://api.myfans.example.com \
  ts-node scripts/rotate-webhook-secret.ts rotate <new-secret>

# 2. (Optional) Shorten the grace period to 1 hour
API_BASE_URL=https://api.myfans.example.com \
  ts-node scripts/rotate-webhook-secret.ts rotate <new-secret> 3600000

# 3. Once all clients have updated their signing key, expire the previous secret immediately
API_BASE_URL=https://api.myfans.example.com \
  ts-node scripts/rotate-webhook-secret.ts expire-previous
```

**Manual steps:**

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Call `POST /v1/webhook/rotate` with `{ "newSecret": "<new-secret>" }`.
3. Update `WEBHOOK_SECRET` in your secret manager and redeploy so the new value is used on the next restart.
4. Notify webhook consumers to update their signing key.
5. After the grace period (or once all consumers have updated), call `POST /v1/webhook/expire-previous`.

**Verify a signature locally:**

```bash
ts-node scripts/rotate-webhook-secret.ts sign <secret> <payload>
```

---

## Startup validation

`src/common/secrets-validation.ts` checks that all required secrets are non-empty before the NestJS application finishes bootstrapping. If any are missing the process exits with a clear error listing every missing variable:

```
[secrets-validation] Missing required environment variables:
  - JWT_SECRET
  - DB_PASSWORD

See backend/.env.example for the full list of required variables.
```

This prevents the app from starting in a partially-configured state that could silently fall back to insecure defaults.

## Manual checklist

Use this checklist after any secret rotation to confirm the change is complete:

- [ ] New secret generated with sufficient entropy (≥ 32 random bytes).
- [ ] Secret updated in the secret manager / deployment environment.
- [ ] Backend redeployed (or process restarted) and startup probes pass.
- [ ] Old secret removed from all local notes, CI variables, and chat logs.
- [ ] For `WEBHOOK_SECRET`: webhook consumers notified and previous secret expired after grace period.
- [ ] For `JWT_SECRET`: users re-authenticated or re-login window communicated.
- [ ] No plaintext secret values appear in application logs (see `docs/` log redaction guidance).

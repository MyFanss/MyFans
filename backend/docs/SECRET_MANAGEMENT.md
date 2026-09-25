# Secret Management

This document describes how secrets are stored, validated, and rotated in the MyFans backend.

## Secrets inventory

| Variable | Purpose | Required | Rotation frequency |
|---|---|---|---|
| `JWT_SECRET` | Signs and verifies JWT access tokens | Yes | On compromise; recommended every 90 days |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL in seconds (default 900) | No | When session policy changes |
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

#### Standard rotation (accepts brief re-login)

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_SECRET` in your secret manager / deployment environment.
3. Redeploy the backend. All existing JWTs are immediately invalid.
4. Notify users that they will need to log in again.

#### Zero-downtime rotation

Run two backend instances briefly in parallel — old instance keeps the old secret, new instance uses the new secret — then drain the old instance once access tokens expire (`JWT_ACCESS_EXPIRES_IN`, default 900 s).

1. Deploy new instance with the new `JWT_SECRET`.
2. Keep old instance running until in-flight tokens expire (≤ 15 min with default TTL).
3. Decommission old instance.
4. Refresh tokens issued before rotation will fail on the new instance; users will be prompted to re-authenticate.

#### CI/CD (GitHub Actions)

Store `JWT_SECRET` as a GitHub Actions secret and reference it in your workflow:

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

To rotate in CI:
1. Go to **Settings → Secrets and variables → Actions**.
2. Update `JWT_SECRET` with the new value.
3. Re-run or trigger a new deployment workflow.

#### Verification after rotation

```bash
# Confirm startup probe passes with new secret
curl -sf http://localhost:3000/v1/health | jq .status
# Attempt login and verify a new JWT is issued
curl -s -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"publicKey":"<G-address>","signature":"<sig>"}' | jq .accessToken
```

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

## Inbound webhook verification

All inbound webhook requests are authenticated with an HMAC-SHA256 signature before any handler runs. Requests that fail verification are rejected with `401 Unauthorized` and are never processed.

### Required headers

| Header | Description |
|---|---|
| `X-Webhook-Signature` | Hex-encoded HMAC-SHA256 of the raw request body, keyed by the webhook secret |
| `X-Webhook-Timestamp` | Unix timestamp (seconds) at which the request was signed |

### Verification rules

1. **Signature** — the middleware recomputes `HMAC-SHA256(secret, rawBody)` and compares it to `X-Webhook-Signature` using a **constant-time** comparison (`crypto.timingSafeEqual`). A mismatch returns `401`.
2. **Dual-secret accept window** — during rotation both the current secret and the previous secret (while still inside its grace period) are accepted. A request is valid if it matches *either* secret. Once the grace period expires, only the current secret is accepted.
3. **Replay protection** — `X-Webhook-Timestamp` must be within the allowed skew window (default ±300 s). Stale or future timestamps are rejected with `401`. Timestamps already seen within the window are rejected as duplicates.
4. **Body integrity** — the signature is computed over the **raw** request body, so any tampering with the payload invalidates the signature.

### Failure responses

| Condition | Status |
|---|---|
| Missing/invalid signature | `401 Unauthorized` |
| Missing/stale/duplicate timestamp | `401 Unauthorized` |
| Signature matches neither current nor previous secret | `401 Unauthorized` |

### Rotation drill

To confirm the dual-secret window works end to end:

1. Rotate the secret with a short grace period:
   ```bash
   API_BASE_URL=https://api.myfans.example.com \
     ts-node scripts/rotate-webhook-secret.ts rotate <new-secret> 3600000
   ```
2. Send a webhook signed with the **previous** secret — expect `200` (still inside the grace window).
3. Send a webhook signed with the **new** secret — expect `200`.
4. Send a webhook with a tampered body or an invalid signature — expect `401`.
5. Send a webhook with a stale timestamp (older than the skew window) — expect `401`.
6. Expire the previous secret and repeat step 2 — expect `401`:
   ```bash
   API_BASE_URL=https://api.myfans.example.com \
     ts-node scripts/rotate-webhook-secret.ts expire-previous
   ```

### Logging

Verification failures are logged with the reason (missing header, bad signature, stale timestamp, duplicate timestamp) but **never** log the secret, the expected signature, or the raw body. See the log redaction guidance in `docs/`.

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

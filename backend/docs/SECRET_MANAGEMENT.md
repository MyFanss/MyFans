# Secret Management

This document describes how secrets are stored, validated, and rotated in the MyFans backend.

## Secrets inventory

| Variable | Purpose | Required | Rotation frequency |
|---|---|---|---|
| `JWT_SECRET` | Signs and verifies JWT access tokens | Yes | On compromise; recommended every 90 days |
| `JWT_SECRET_PREVIOUS` | Previous JWT signing key, accepted during rotation | No | Cleared after rotation completes |
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

## Ownership

| Secret | Owner | Rotation approver |
|---|---|---|
| `JWT_SECRET` / `JWT_SECRET_PREVIOUS` | Backend lead | Backend lead |
| `DB_PASSWORD` | Platform / DBA | Platform lead |
| `WEBHOOK_SECRET` | Integrations owner | Backend lead |
| CI/CD secrets (GitHub Actions) | Repo admin | Repo admin |

- The **owner** is responsible for scheduling rotations and executing the runbook.
- The **approver** must sign off before a production rotation begins.
- Rotations are recorded in the incident/change log with timestamp, operator, and reason.

## Rotation runbooks

### JWT_SECRET

Rotating `JWT_SECRET` immediately invalidates all existing sessions. Plan for a brief re-login window.

#### Dual-key acceptance

The backend accepts **two** JWT signing keys during a rotation window:

- `JWT_SECRET` — the current key, used to **sign** all newly issued tokens.
- `JWT_SECRET_PREVIOUS` — the previous key, used only to **verify** tokens that were issued before rotation.

Verification tries the current key first, then falls back to `JWT_SECRET_PREVIOUS` if set. Signing always uses `JWT_SECRET`. This lets old and new keys validate simultaneously so no in-flight token is rejected mid-rotation. When `JWT_SECRET_PREVIOUS` is unset, only the current key is accepted.

#### Standard rotation (accepts brief re-login)

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Update `JWT_SECRET` in your secret manager / deployment environment.
3. Redeploy the backend. All existing JWTs are immediately invalid.
4. Notify users that they will need to log in again.

#### Zero-downtime rotation (dual-key)

Use the dual-key window so no user is logged out and no instance rejects a valid token.

1. Generate a new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Set `JWT_SECRET_PREVIOUS` to the **current** `JWT_SECRET` value, and set `JWT_SECRET` to the **new** value, in your secret manager.
3. Roll out the change to **all** instances (rolling deploy). During this window every instance accepts both keys; new tokens are signed with the new key.
4. Wait at least one full access-token TTL (`JWT_ACCESS_EXPIRES_IN`, default 900 s) so all tokens signed with the old key have expired.
5. Unset `JWT_SECRET_PREVIOUS` and roll out again. Only the new key is now accepted.
6. Confirm no instance still references the old key (see verification below).

> **Partial rollout (multi-instance):** if only some instances have the new `JWT_SECRET` while others still run the old one, tokens signed by one group will be rejected by the other. Always set `JWT_SECRET_PREVIOUS` to the old value **before** switching `JWT_SECRET`, and roll out to every instance before removing the previous key.

#### CI/CD (GitHub Actions)

Store `JWT_SECRET` as a GitHub Actions secret and reference it in your workflow:

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  JWT_SECRET_PREVIOUS: ${{ secrets.JWT_SECRET_PREVIOUS }}
```

To rotate in CI:
1. Go to **Settings → Secrets and variables → Actions**.
2. Set `JWT_SECRET_PREVIOUS` to the old value and update `JWT_SECRET` with the new value.
3. Re-run or trigger a new deployment workflow.
4. After one TTL, delete `JWT_SECRET_PREVIOUS` and redeploy.

#### Verification after rotation

```bash
# Confirm startup probe passes with new secret
curl -sf http://localhost:3000/v1/health | jq .status
# Attempt login and verify a new JWT is issued
curl -s -X POST http://localhost:3000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"publicKey":"<G-address>","signature":"<sig>"}' | jq .accessToken
# Confirm a token signed with the previous key still validates during the window
curl -s http://localhost:3000/v1/auth/me \
  -H 'Authorization: Bearer <token-signed-with-previous-key>' | jq .id
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

## Incident response checklist

Use this checklist when a secret is suspected compromised or a rotation fails. Work top to bottom; do not skip the verification steps.

- [ ] **Declare** the incident and assign an incident lead (see Ownership).
- [ ] **Identify** which secret is affected (`JWT_SECRET`, `DB_PASSWORD`, `WEBHOOK_SECRET`, CI/CD).
- [ ] **Contain** — if a secret may have leaked, rotate it immediately rather than waiting for the scheduled window.
- [ ] **Rotate** using the matching runbook above:
  - JWT: set `JWT_SECRET_PREVIOUS` to the old value, set `JWT_SECRET` to the new value, roll out to all instances, then clear `JWT_SECRET_PREVIOUS` after one TTL.
  - DB: `ALTER USER` with the new password, update the secret manager, redeploy.
  - Webhook: rotate with a short grace period, notify consumers, then `expire-previous`.
- [ ] **Verify** — run the verification commands for the rotated secret; confirm health probe, login, and (for JWT) that a previous-key token still validates during the window.
- [ ] **Invalidate** — for a compromised JWT key, do **not** keep the old key in `JWT_SECRET_PREVIOUS`; clear it immediately so leaked tokens cannot be replayed.
- [ ] **Audit** — review access logs for use of the compromised secret and check for unauthorized access.
- [ ] **Record** — log the incident: timestamp, operator, secret affected, rotation performed, and follow-up actions.
- [ ] **Notify** — inform affected users/consumers if sessions were invalidated or signing keys changed.
- [ ] **Review** — schedule a post-incident review and update this runbook if any step was unclear.

### Staging drill

Before relying on this runbook in production, rehearse it in staging:

1. Perform a full dual-key JWT rotation (set previous, switch current, roll out, wait one TTL, clear previous).
2. Confirm a token signed with the previous key validates during the window and is rejected after `JWT_SECRET_PREVIOUS` is cleared.
3. Walk the incident checklist end to end and note any gaps.
4. Have a peer review the checklist and record the drill outcome.

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

This prevents the app from starting with an incomplete configuration.

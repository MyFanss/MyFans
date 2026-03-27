# Webhook Secret Rotation

## Overview

Incoming webhooks are authenticated with an **HMAC-SHA256** signature sent in the
`x-webhook-signature` request header.  
The backend supports **seamless rotation**: during a configurable cutoff window both
the new (active) and the old (previous) secret are accepted, so no in-flight
webhooks are dropped.

---

## Setup

Set the initial secret in your environment:

```env
WEBHOOK_SECRET=your-strong-random-secret
```

The `WebhookService` reads this value on startup.

---

## Signing a Payload (sender side)

```ts
import { createHmac } from 'crypto';

const signature = createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody)          // always sign the raw request body string
  .digest('hex');

// Send as header:
// x-webhook-signature: <signature>
```

---

## Rotation Flow

```
Time ──────────────────────────────────────────────────────────►

  [old secret active]
        │
        ▼  POST /v1/webhook/rotate  { newSecret, cutoffMs? }
        │
  [new secret = active]  [old secret = previous, valid until cutoffAt]
        │                       │
        │   webhooks signed     │   webhooks signed with OLD secret
        │   with NEW secret ✅  │   still accepted ✅ (within cutoff)
        │                       │
        │                 cutoffAt reached  ──► old secret rejected ❌
        │
  POST /v1/webhook/expire-previous   (optional: force-expire early)
```

### Default cutoff: **24 hours**

Pass `cutoffMs` in the rotate request body to override:

```json
{ "newSecret": "new-strong-secret", "cutoffMs": 3600000 }
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/webhook` | Receive a signed webhook event |
| `POST` | `/v1/webhook/rotate` | Rotate to a new secret |
| `POST` | `/v1/webhook/expire-previous` | Immediately invalidate the previous secret |

> **Note:** In production, protect `/rotate` and `/expire-previous` with an
> admin/JWT guard.

---

## CLI

```bash
# Rotate to a new secret (24 h cutoff by default)
ts-node scripts/rotate-webhook-secret.ts rotate <newSecret>

# Rotate with a custom 1-hour cutoff
ts-node scripts/rotate-webhook-secret.ts rotate <newSecret> 3600000

# Force-expire the previous secret immediately
ts-node scripts/rotate-webhook-secret.ts expire-previous

# Sign a payload locally (for testing)
ts-node scripts/rotate-webhook-secret.ts sign <secret> '{"event":"test"}'
```

Set `API_BASE_URL` to target a non-local environment:

```bash
API_BASE_URL=https://api.myfans.app ts-node scripts/rotate-webhook-secret.ts rotate <newSecret>
```

---

## Testing

```bash
# Unit tests (WebhookService + WebhookGuard)
npm test -- --testPathPattern=webhook

# All tests
npm test
```

---

## Security Notes

- Signatures are compared with **`timingSafeEqual`** to prevent timing attacks.
- Always sign the **raw request body** (before JSON parsing).
- Use a minimum secret length of **32 random bytes** (e.g. `openssl rand -hex 32`).
- Rotate secrets periodically and after any suspected compromise.

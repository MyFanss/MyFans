# Email Outbox — Transactional Outbox Pattern

## Overview

Every email is persisted to the `email_outbox` table before delivery is
attempted. The row stays in the table until it reaches a terminal status,
guaranteeing at-least-once delivery even if the application crashes mid-send.

## Status Lifecycle

```
PENDING ──► SENT            (delivery successful)
   │
   ▼
PENDING ──► DEAD_LETTER     (max attempts exhausted — needs admin intervention)
   │
   ▼
PENDING ──► SUPPRESSED      (recipient account deleted)
```

| Status        | Meaning                                               |
|---------------|-------------------------------------------------------|
| `PENDING`     | Awaiting delivery (or retry).                         |
| `SENT`        | Delivered successfully; `provider_message_id` stored. |
| `DEAD_LETTER` | All 5 delivery attempts exhausted.                    |
| `FAILED`      | Legacy status (pre-dead-letter); treated like dead letter. |
| `SUPPRESSED`  | Recipient deleted; delivery skipped.                  |

## Provider Message ID

On successful delivery the email adapter returns a `messageId` (e.g. the SMTP
queue ID or SES message ID). This is stored in `provider_message_id` for
end-to-end delivery tracing.

## Cron Configuration

The retry worker runs on a configurable cron schedule:

```
EMAIL_OUTBOX_CRON="* * * * *"    # default: every minute
```

Set a less frequent schedule if you want to reduce DB queries:

```
EMAIL_OUTBOX_CRON="*/5 * * * *"  # every 5 minutes
```

## Dead Letter Replay

Admin users can list and replay dead-lettered emails via the REST API:

```
GET  /v1/admin/email-outbox/dead-letters   — list failed entries
POST /v1/admin/email-outbox/:id/replay     — reset entry to PENDING
```

Replaying resets `attempts` to 0 and status to `PENDING`, so the retry
worker picks it up on the next tick.

## Docker Compose SMTP Setup

```yaml
services:
  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI

  backend:
    environment:
      SMTP_HOST: mailhog
      SMTP_PORT: 1025
      SMTP_FROM: noreply@myfans.local
```

Access MailHog's web UI at `http://localhost:8025` to inspect delivered emails.

## Deduplication

Each outbox entry has a unique `dedupe_key`. If `enqueue()` is called with a
key that already exists, the existing row is returned without creating a
duplicate — making the enqueue operation idempotent.

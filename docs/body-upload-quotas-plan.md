# Plan: Explicit Body / Upload Quotas

## Problem

`main.ts` boots the Nest app with no explicit body-size limit, and content
upload endpoints (`content.controller.ts`, `ipfs.service.ts`) accept
metadata/uploads with no enforced size or rate cap. Missing quotas invite
abuse: oversized payloads (memory pressure) and unbounded upload volume
(IPFS pinning cost abuse).

## Proposed quotas

See `backend/src/common/constants/body-upload-quotas.ts`:

- `MAX_JSON_BODY_BYTES` — cap for `express.json({ limit })` in `main.ts`.
- `MAX_UPLOAD_BYTES` — cap per content upload.
- `MAX_UPLOADS_PER_CREATOR_PER_HOUR` — per-creator rate limit, enforced the
  same way `subscriptions.throttle.spec.ts` / the auth throttle guard
  (`ThrottlerGuard` usage in `auth`) already do for other routes.

## Wiring (follow-up, not in this change)

1. `main.ts`: `NestFactory.create(AppModule, { bodyParser: false })` then
   `app.use(express.json({ limit: MAX_JSON_BODY_BYTES }))`.
2. `content.controller.ts`: add a throttle guard on the create/upload route
   using `MAX_UPLOADS_PER_CREATOR_PER_HOUR`.
3. `content.service.ts` / `ipfs.service.ts`: reject uploads whose payload
   exceeds `MAX_UPLOAD_BYTES` before calling `uploadMetadata`.

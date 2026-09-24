# CSRF Protection

This document describes how CSRF protection works across the app, with a
focus on the messages module (`frontend/e2e/messages-flow.spec.ts`).

## Overview

State-changing requests (POST/PUT/PATCH/DELETE) must carry a valid CSRF
token. The token is issued by the backend and stored in a cookie that is
readable by JavaScript (`csrf_token`), then echoed back in the
`X-CSRF-Token` request header.

## Token lifecycle

1. On app bootstrap the client calls `GET /api/csrf` (or reads the
   `csrf_token` cookie set on the initial document response).
2. The token is kept in memory and attached to every mutating request.
3. On `403` responses with a CSRF error code, the client refreshes the
   token once and retries the request.

## Messages module

Sending a message is a state-changing operation and therefore **requires**
a CSRF token:

- `POST /api/threads/:threadId/messages` MUST include the
  `X-CSRF-Token` header.
- Requests missing or carrying an invalid token are rejected with
  `403 Forbidden` and are never persisted.
- The e2e suite (`messages-flow.spec.ts`) asserts that a send without a
  CSRF token fails and that a send with a valid token succeeds.

### Auth headers

In addition to the CSRF token, message requests carry the standard auth
headers (session cookie / `Authorization: Bearer <token>`). Only
authenticated participants of a thread may read or send messages; the
backend enforces this authorization and returns `403` for non-participants.

### Typed DTOs

Message payloads are validated against typed DTOs (no `any`). Invalid
bodies are rejected with `400 Bad Request` before any persistence occurs.

### Rendering safety

Message bodies are treated as untrusted input. They are escaped/sanitized
on render to prevent stored XSS.

## Rate limiting

Send endpoints are rate limited per user/thread to mitigate abuse. Exceeding
the limit returns `429 Too Many Requests`.

## Out of scope

End-to-end encryption (E2EE) is not covered by this document.

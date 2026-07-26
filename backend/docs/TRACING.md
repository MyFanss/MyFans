# Distributed Tracing (OpenTelemetry)

Correlation IDs are propagated per-request today (see `RequestContextService`
/ `correlation-exception.filter.ts`), but there is no span export, so a
correlation ID can't be used to pull up a distributed trace for auth,
checkout, or webhook calls.

## Goal

Add optional OTel trace export, gated entirely behind an env var so it has
zero effect when unset and no hard runtime dependency when not installed.

## Enabling

```
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_SERVICE_NAME=myfans-backend   # optional, defaults to myfans-backend
```

Install the SDK packages only when you intend to turn this on:

```
npm install --prefix backend \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-http
```

## Implementation

`src/common/tracing/otel-tracing.ts` exports:

- `initTracing()` — call once from `main.ts` bootstrap, before `NestFactory.create`.
- `withSpan(name, fn)` — wrap a critical-route handler body to emit a named span.
- `CRITICAL_ROUTES` — the route names intended to be spanned:
  `auth.login`, `auth.register`, `auth.challenge`, `auth.challenge.verify`,
  `checkout.create`, `checkout.confirm`, `webhook.receive`.

## Wiring into critical routes (not applied yet)

```ts
import { withSpan } from '../common/tracing/otel-tracing';

@Post('login')
async login(@Body() dto: LoginBodyDto) {
  return withSpan('auth.login', () => this.authService.login(dto));
}
```

Do the same for the checkout controller's create/confirm handlers and the
webhook controller's receive handler. Each span should carry the existing
correlation ID as an attribute (`span.setAttribute('correlationId', id)`) so
traces and logs can be cross-referenced.

## Status

This is scaffolding only — `initTracing`/`withSpan` are not yet called from
`main.ts` or the controllers. Wiring them in is a follow-up once the OTel
collector endpoint is available in each environment.

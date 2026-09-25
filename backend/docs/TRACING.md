# Distributed Tracing (OpenTelemetry)

Correlation IDs are propagated per-request today (see `RequestContextService`
/ `correlation-exception.filter.ts`), but there is no span export, so a
correlation ID can't be used to pull up a distributed trace for auth,
checkout, or webhook calls.

## Correlation ID propagation

Every request carries an `X-Correlation-Id` header. The middleware accepts a
client-supplied id when it is well-formed and otherwise generates a fresh one:

- Charset: `[A-Za-z0-9._-]` only (no PII, no free-form text).
- Length: 8–128 characters; missing, invalid, or overlong ids are replaced
  with a generated UUID.
- The resolved id is echoed back on the response `X-Correlation-Id` header and
  stored on the request context so logs and error envelopes can reference it.

The global exception filter includes the id in every error envelope, keeping
the shape stable for clients:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "code": "INTERNAL_ERROR",
  "correlationId": "3f9c1e2a-..."
}
```

The nest-winston log format attaches the same `correlationId` to each log
entry (existing redaction of sensitive fields is unchanged). The frontend
api-client surfaces `correlationId` on error types and displays it on fatal
errors so a checkout failure can be traced across UI, API, and poller.

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

## Checkout confirm and poller iteration spans

Two multi-hop paths are instrumented so latency can be attributed per hop
instead of only per request:

- `checkout.confirm` — wraps the checkout confirm handler body. The span
  covers the confirm call through to the service response, so a slow confirm
  is distinguishable from a slow upstream create.
- `poller.iteration` — wraps each poller loop iteration. One span is emitted
  per iteration, so a backlog or a stalled iteration shows up as a long or
  missing span rather than an opaque gap between log lines.

Both spans attach the resolved correlation ID as a `correlationId` attribute
(`span.setAttribute('correlationId', id)`), matching the attribute used by the
other critical routes. This lets a trace be pulled up directly from a
correlation ID surfaced in an error envelope or log line.

### Correlation attributes

- Attribute name: `correlationId`.
- Value: the same id propagated via `X-Correlation-Id` (charset
  `[A-Za-z0-9._-]`, 8–128 chars).
- No PII is placed on spans: only the correlation ID and the span name are
  set. Request bodies, headers, and user identifiers are never attached.

### Enabling

These spans are emitted only when tracing is enabled via the env var:

```
OTEL_ENABLED=true
```

When `OTEL_ENABLED` is unset or not `true`, `withSpan` is a pass-through and
no spans are created, so there is no behavior change and no runtime cost in
environments without a collector.

### Overhead notes

- With tracing disabled, `withSpan` adds a single function call and no
  allocation beyond the wrapped promise.
- With tracing enabled, each confirm and each poller iteration emits one span.
  Poller iteration spans are bounded by the poll interval, so span volume
  scales with iterations, not with request rate.
- High cardinality: the only attribute is `correlationId`, which is
  per-request. Collectors should sample or aggregate on span name rather than
  on `correlationId` to avoid unbounded cardinality in metrics derived from
  spans.

## Status

`initTracing`/`withSpan` are wired into the checkout confirm handler and the
poller iteration loop. The remaining critical routes (`auth.*`,
`checkout.create`, `webhook.receive`) still need the same `withSpan` wrapping
as a follow-up once the OTel collector endpoint is available in each
environment.

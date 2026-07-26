# Free-text Secret Redaction

## Problem

`src/common/utils/redact.ts` (`redact()`) already strips known-sensitive
*keys* out of objects before logging (see `LoggerService.sanitizeMessage`),
but it can't help when a secret is embedded inside a plain **string** —
e.g. a thrown `Error('Invalid signature for token eyJhbGci...')`, a webhook
verification failure whose message interpolates the signing secret, or a
stack trace line containing an Authorization header. Those strings are
logged as-is by `LoggerService.error/warn/log` today.

## Solution added here

`src/common/utils/redact-string.util.ts`:

- `redactString(input)` — regex-redacts JWT-shaped tokens
  (`ey...\.ey...\....`), `Authorization: Bearer <token>` values, and
  `secret=...` / `token: ...` style key-value substrings out of a string.
- `redactError(err)` — convenience wrapper returning a redacted
  `{ message, stack }` pair for any thrown value.

Tests: `src/common/utils/redact-string.util.spec.ts`.

## Wiring in (not applied — additive-only change per request)

**Logger** (`src/common/services/logger.service.ts`): in
`sanitizeMessage`, when `message` is a string, run it through
`redactString()` instead of passing it through as-is:

```ts
private sanitizeMessage(message: any): string {
  if (typeof message === 'string') {
    return redactString(message);
  }
  ...
}
```

**Exception filters** (`src/common/filters/correlation-exception.filter.ts`
and the per-module filters under `src/*/filters/`): when logging
`exception.message` / `exception.stack`, pass through `redactError(exception)`
instead of the raw `Error` fields.

## Follow-up

- Extend `KEYED_SECRET_PATTERN` in `redact-string.util.ts` if new secret
  naming conventions are introduced (e.g. `stellar_secret=`).
- Consider running `redactString` on `req.url`/query strings too, since a
  leaked token could arrive as a query parameter.

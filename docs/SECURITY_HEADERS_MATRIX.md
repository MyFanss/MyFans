# Security Headers Ownership Matrix

Single source of truth for **which layer sets which security header** across the
backend (Helmet), the frontend (Next.js CSP), wallet browser extensions, and the
edge / preview infrastructure.

Related docs:

- [`frontend/docs/CSP.md`](../frontend/docs/CSP.md) — Next.js Content-Security-Policy details.
- [`backend/docs/CORS_AND_SECURITY_HEADERS.md`](../backend/docs/CORS_AND_SECURITY_HEADERS.md) — Helmet + CORS configuration.

> Scope note: Cloudflare WAF rulesets are **out of scope** for this document.

---

## 1. Why a matrix

Headers are set in more than one place. When ownership is ambiguous we end up
with either:

- **Broken wallets** — an over-strict `connect-src` / `frame-ancestors` / COEP
  policy blocks the injected provider or the wallet popup, or
- **Weak XSS posture** — a layer silently drops a header the other layer assumed
  it owned.

This matrix assigns exactly one owner per header per environment.

---

## 2. Ownership matrix

Legend: **B** = backend (Helmet), **F** = frontend (Next.js), **E** = edge /
platform (CDN, preview host), **W** = wallet extension (client-side, not ours).

| Header | Owner | Notes |
| --- | --- | --- |
| `Content-Security-Policy` | **F** (app pages), **B** (API responses) | API responses get a locked-down `default-src 'none'`. App pages use the Next CSP. |
| `Strict-Transport-Security` | **E** (prod/staging), **B** fallback | Only meaningful over HTTPS. Never set on local dev. |
| `X-Frame-Options` | **B** / **F** | `DENY` for API; `SAMEORIGIN` for app unless a wallet needs framing. Superseded by `frame-ancestors` where CSP is present. |
| `X-Content-Type-Options` | **B** + **F** | Always `nosniff`. |
| `Referrer-Policy` | **B** + **F** | `strict-origin-when-cross-origin`. |
| `Permissions-Policy` | **F** | Disable unused features (`camera`, `microphone`, `geolocation`, …). |
| `Cross-Origin-Opener-Policy` (COOP) | **F** | `same-origin-allow-popups` when wallet popups are used. |
| `Cross-Origin-Embedder-Policy` (COEP) | **F** | `unsafe-none` by default; see §5 before enabling `require-corp`. |
| `Cross-Origin-Resource-Policy` (CORP) | **B** + **F** | `same-site` for app assets; API uses CORS instead. |
| `Access-Control-Allow-Origin` (CORS) | **B** | Explicit allowlist. Never `*` with credentials. See backend doc. |
| `Access-Control-Allow-Credentials` | **B** | Only with an explicit origin. |
| `Access-Control-Allow-Headers` / `-Methods` | **B** | Keep minimal. |
| `Cache-Control` (sensitive) | **B** | `no-store` on authenticated responses. |

---

## 3. Per-environment examples

### Local dev

- **B**: Helmet with `contentSecurityPolicy: false` (Next dev server owns CSP),
  `crossOriginEmbedderPolicy: false`, HSTS off.
- **F**: relaxed CSP allowing `'unsafe-eval'` for the dev bundler and
  `ws:`/`wss:` for HMR. **Never ship this to prod.**
- **E**: none.

### Preview deploys

- **F**: same CSP as production, but `connect-src` must include the preview API
  origin (e.g. `https://api-preview.example.com`).
- **E**: preview hosts often inject their own `X-Frame-Options` / CSP; verify
  they do not conflict with the app CSP (see §6).
- **B**: preview API uses the preview CORS allowlist, not the prod one.

### Staging

- **B**: full Helmet set, HSTS with a short `max-age` (e.g. `300`).
- **F**: production CSP.
- **E**: HSTS enabled.

### Production

- **B**: full Helmet set, HSTS `max-age=63072000; includeSubDomains; preload`.
- **F**: production CSP, no `'unsafe-inline'` / `'unsafe-eval'` (see §5).
- **E**: HSTS + TLS termination.

---

## 4. Wallet extension requirements

Wallet extensions (MetaMask, Coinbase Wallet, WalletConnect, …) inject a
provider and/or open a popup. They impose concrete header requirements:

- **`connect-src`** must include the RPC endpoints the app talks to, plus the
  wallet bridge origins (e.g. `https://*.walletconnect.com`, `wss://*.walletconnect.com`).
  Missing entries cause silent connection failures.
- **`frame-ancestors` / `X-Frame-Options`** must allow the wallet popup to frame
  the app when the flow requires it. Prefer `frame-ancestors 'self'` plus the
  specific wallet origin over a blanket `*`.
- **COOP** should be `same-origin-allow-popups` so the popup can communicate back
  via `window.opener`.
- **COEP** must stay `unsafe-none` unless every cross-origin resource the wallet
  needs sends CORP/CORS headers. Enabling `require-corp` without that breaks
  injected providers.
- **`img-src` / `style-src`** must allow wallet-hosted assets (icons, QR codes)
  if the UI renders them.

---

## 5. Avoiding `unsafe-inline`

`'unsafe-inline'` (and `'unsafe-eval'`) defeat much of CSP's XSS protection.

- Do **not** add them to production CSP.
- If a third-party script genuinely requires inline execution, use a **nonce**
  or **hash** instead, and document the justification in the PR that adds it.
- Any exception must reference an issue explaining why a nonce/hash is not
  possible.

---

## 6. Verification steps

1. **Inspect response headers** for the app and the API:

   ```sh
   curl -sI https://app.example.com | grep -iE 'content-security-policy|strict-transport|x-frame|x-content-type|referrer|permissions-policy|cross-origin'
   curl -sI https://api.example.com | grep -iE 'content-security-policy|strict-transport|x-frame|x-content-type|referrer|cross-origin|access-control'
   ```

2. **Confirm no duplicate/conflicting headers.** Two `Content-Security-Policy`
   headers are intersected by browsers, which usually breaks the app. If the
   edge injects one, remove it there.

3. **Check the browser console** for CSP violations on load and during a wallet
   connect flow. Every violation should map to an intentional entry in the CSP.

4. **Exercise a wallet connect + sign flow** end-to-end on staging before prod.

5. **Preview deploy check**: repeat steps 1–3 against the preview URL, since
   preview hosts frequently add their own headers.

---

## 7. Edge cases & failure modes

- **Preview deploys** may inject `X-Frame-Options: DENY` or a restrictive CSP,
  breaking embedded wallet flows. Verify and override at the edge if needed.
- **Duplicate CSP headers** from edge + app are intersected, not replaced.
- **HSTS on localhost** can pin a dev machine to HTTPS; never enable it locally.
- **COEP `require-corp`** silently blocks cross-origin wallet resources.
- **CORS `*` with credentials** is rejected by browsers; always use an explicit
  origin allowlist.

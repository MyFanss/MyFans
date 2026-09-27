# Testnet Beta Bug Bash Checklist

> Issue #1850. Run on the **testnet beta** deployment (see [Testnet Beta Runbook](TESTNET_BETA_RUNBOOK.md)) before widening invites, and again before the [Mainnet Readiness Gate](MAINNET_READINESS.md) (item B3).
> Owner: QA lead for the bash.

Every check has a **binary** pass criterion. If you have to ask "does this count?", mark it **FAIL** and explain in the notes. The QA lead then either fixes the wording here or files the bug.

> **No real funds.** Only Stellar **testnet** and friendbot-funded throwaway accounts. Never connect a wallet that holds mainnet assets, never switch Freighter to Mainnet during the bash, and never paste a secret key into anything.

Setup for every tester: follow [QUICKSTART](../QUICKSTART.md) §1–2 (Freighter on Testnet) and use the beta URL from the invite.

---

## 1. Roles

| Role | Count | Responsibility |
|---|---|---|
| **QA lead** | 1 | Assigns sections, runs triage, owns the result sheet, declares done |
| **Creator testers** | ≥ 2 | Create plans, publish gated content, check earnings/payout |
| **Fan testers** | ≥ 3 | Subscribe, access, cancel, renew. At least one on mobile, one keyboard-only |
| **Outsider** | ≥ 1 | Never subscribes. Tries to reach gated content and admin endpoints |
| **Contract operator** | 1 | Runs §4 pause steps with the admin key (the only person who does) |
| **Scribe** | 1 (may be QA lead) | Records tx hashes, screenshots, bug links in the result sheet |

Each tester uses **fresh** Freighter accounts created for the bash, funded with friendbot. Label them `bash-creator-1`, `bash-fan-1`, etc.

### Severity

| Sev | Meaning | Examples |
|---|---|---|
| **1** | Money lost or misrouted, gated content leaked, auth bypass, pause doesn't stop payments | Wrong fee split, `contentCid` returned without access, CSRF-less mutation accepted |
| **2** | Core flow blocked for many users, no workaround | Subscribe always fails, poller never confirms |
| **3** | Flow works with a workaround, or a UX bug on the money path | Confusing error, stale status until refresh |
| **4** | Cosmetic, copy, minor a11y | Typos, contrast on non-critical text |

The bash is **done** when every row is PASS, or FAIL with a linked issue, **and** there are zero open Sev-1/Sev-2.

---

## 2. Money path

Tester: creator + fan. Record every tx hash.

| ID | Check | PASS when |
|---|---|---|
| M1 | Creator creates a plan in the UI (XLM, smallest allowed price, shortest interval) | Freighter prompts once, the tx succeeds, and the plan shows in the dashboard and in `GET /plans?creator=<address>` |
| M2 | Fan subscribes to M1's plan | Freighter shows the correct amount and asset, and the tx succeeds |
| M3 | Fee split is correct | On stellar.expert for the M2 tx: creator received `amount − fee`, treasury received `fee`, where `fee = amount × protocol_fee_bps / 10000` from `get_config` (±1 stroop rounding) |
| M4 | Checkout confirms through the poller | UI goes Pending → confirmed within **2 min**, with no manual refresh needed |
| M5 | Fan's active subscriptions page shows it | Correct creator, plan, and expiry |
| M6 | Payment history shows it | The entry exists and the tx hash links to the M2 tx |
| M7 | Insufficient balance | Fan with less than the plan price tries to subscribe → clear "insufficient balance" error, **no** tx submitted, or the tx reverts with nothing charged |
| M8 | Double click / double submit on Subscribe | At most one on-chain subscription and one charge |
| M9 | User rejects in Freighter | UI returns to a retryable state within 5 s. No stuck Pending |
| M10 | Renew | Renew (or `extend_subscription`) moves expiry forward by one interval and charges once |
| M11 | Cancel | After indexing, `is_subscriber` = false and the UI shows cancelled. No refund is shown or implied, unless product rules say otherwise |
| M12 | Creator earnings view | Creator's earnings total increases by exactly the M3 creator amount |
| M13 | Payout / withdraw (only if `earnings_withdrawals` is on) | Withdraw succeeds, the amount arrives at the creator's address, the UI balance drops by the same amount, and a second withdraw of the same funds fails |
| M14 | Wrong network | Freighter switched to Futurenet or Public → the app blocks signing with a network mismatch message ([Network Guard](../frontend/docs/NETWORK_GUARD.md)) |

## 3. Wallet and auth

| ID | Check | PASS when |
|---|---|---|
| W1 | Connect Freighter (fresh account) | Connects, shows the correct truncated G-address |
| W2 | Challenge login | The wallet-signed challenge succeeds and the session is established |
| W3 | Freighter locked or missing | A clear prompt appears to install or unlock. No blank screen or console crash |
| W4 | Switch account in Freighter mid-session | The app detects the change and either re-authenticates or signs out. It never keeps acting as the old account |
| W5 | Logout | Session cleared. Protected pages redirect to login. Browser back does not show private data |
| W6 | Expired or invalid token | Tamper with or expire the JWT → API returns 401, and the UI redirects to login without a loop |
| W7 | Challenge replay | Re-submitting a previously used signed challenge is rejected |
| W8 | Login throttling | Rapid repeated challenge requests eventually get 429 ([Challenge Login Throttling](../backend/docs/CHALLENGE_LOGIN_THROTTLING.md)) |
| W9 | Role separation | A fan account cannot open creator-only pages or APIs (403 or redirect) |
| W10 | Lobstr / WalletConnect (only if enabled) | Connect and subscribe work. If the flag is off, the UI shows "Coming soon", not a broken button |

## 4. Content gating

Tester: creator, fan, outsider.

| ID | Check | PASS when |
|---|---|---|
| G1 | Creator publishes a subscribers-only item | The item is saved and visible in the creator's own view |
| G2 | Outsider (logged out) views the creator page | Teaser only. `GET /creators/:id/access` returns `hasAccess: false` and `contentCid: null` |
| G3 | Outsider (logged in, not subscribed) | Same as G2 |
| G4 | Subscribed fan | Full content is visible, and `/access` returns `hasAccess: true` with a `contentCid` |
| G5 | Direct URL / API to gated item as the outsider | No body, CID or media URL in the response (check the network tab and page source) |
| G6 | After cancel (M11) | Access is revoked after indexing. A reload shows the teaser only |
| G7 | After expiry | With a short plan, wait past expiry → access is revoked with no manual action |
| G8 | Feed and search | Gated items show teasers only to non-subscribers. The full body never appears in list responses |
| G9 | Content upload (only if `contentUploads` is on) | Upload succeeds. Non-creators cannot upload (403) |

## 5. Pause (contract operator + one fan)

Coordinate in the bash channel. Pause for as short a time as possible.

| ID | Check | PASS when |
|---|---|---|
| P1 | Operator runs `pause` on subscription | `get_config.paused` = true |
| P2 | Fan tries to subscribe while paused | Reverts with `Paused` (4). The UI shows a clear "temporarily paused" message, **not** a stuck Pending |
| P3 | Existing subscriber while paused | Can still access gated content (G4 still passes) |
| P4 | Non-admin tries `pause`/`unpause` | Auth fails. State unchanged |
| P5 | Treasury `set_paused(true)` | Fee deposits and withdraws are blocked while paused |
| P6 | Unpause both | Subscribe works again (repeat M2 with a new fan) |

## 6. Security headers, CSRF, CSP

Tester: anyone with devtools. Use the beta URLs.

| ID | Check | PASS when |
|---|---|---|
| H1 | CSP header present on the frontend document | `Content-Security-Policy` is present, and `connect-src` lists the API origin and testnet RPC/Horizon only ([CSP](../frontend/docs/CSP.md)) |
| H2 | No CSP violations during M1–M6 | The devtools console shows **zero** CSP violation reports |
| H3 | Other security headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a framing restriction (`X-Frame-Options` or CSP `frame-ancestors`) are present ([Security Headers](../frontend/docs/SECURITY_HEADERS.md)) |
| H4 | Clickjacking | Embedding the app in an `<iframe>` on another origin is blocked |
| H5 | CSRF: mutating request without token | Replay a POST/PUT/PATCH/DELETE (e.g. from the messages or settings flow) with the `X-CSRF-Token` header removed → **403** ([CSRF](../frontend/docs/CSRF.md)) |
| H6 | CSRF: wrong token | Same request with a different or stale token → 403 |
| H7 | CORS | `fetch(<api>/v1/...)` from an unlisted origin (e.g. a local HTML file) with credentials is blocked by CORS ([CORS & headers](../backend/docs/CORS_AND_SECURITY_HEADERS.md)) |
| H8 | Cookies | Session cookies are `Secure`, `HttpOnly` (except `csrf_token`), and have `SameSite` set |
| H9 | Secrets in the bundle | Searching the frontend JS bundles for `SECRET`, `PRIVATE`, and `S` + 55 base32 chars (a Stellar secret key) finds nothing |
| H10 | Error responses | Forcing 4xx/5xx (bad ids, malformed JSON) returns no stack traces, SQL or internal paths |
| H11 | Rate limiting | Hammering a public endpoint eventually returns 429 ([Rate Limiting](../backend/docs/RATE_LIMITING.md)) |

## 7. Accessibility

Tester: at least one keyboard-only and one screen-reader user (VoiceOver or NVDA).

| ID | Check | PASS when |
|---|---|---|
| A1 | Keyboard-only: connect → subscribe → view content → cancel | The whole flow is completable without a mouse, and focus is always visible |
| A2 | Modals (wallet connect, confirm) | Focus is trapped inside while open, Esc closes, and focus returns to the trigger |
| A3 | Screen reader: checkout status | Pending / confirmed / failed changes are announced (`aria-live`) |
| A4 | Form errors | Each error is tied to its field (`aria-describedby`) and announced |
| A5 | Automated scan | axe DevTools (or Lighthouse a11y) on home, creator page, checkout and dashboard shows **zero** "serious" or "critical" issues |
| A6 | Zoom 200% and a 375px-wide viewport | No horizontal scroll, and nothing clipped on the money path |

## 8. Resilience (optional, QA lead decides)

| ID | Check | PASS when |
|---|---|---|
| R1 | Backend down during checkout | The UI shows a retryable error. The on-chain tx (if signed) is still confirmed after the backend is back |
| R2 | Slow network (devtools "Slow 3G") | No duplicate submissions. Spinners resolve or time out with a message |
| R3 | Refresh during Pending | Status resumes correctly after reload |

---

## 9. Result template

Copy into the bug bash tracking issue. One row per check per tester who ran it.

```
Bug bash: <beta tag / SHA>   Date (UTC): <date>   QA lead: <name>
Frontend URL:            API URL:
Subscription contract id:          Flags on:

| ID  | Tester | Browser / OS / Wallet | Result (PASS/FAIL/N/A) | Evidence (tx hash / screenshot) | Issue | Sev |
|-----|--------|-----------------------|------------------------|---------------------------------|-------|-----|
| M1  |        |                       |                        |                                 |       |     |
| ... |        |                       |                        |                                 |       |     |

Summary: PASS __ / FAIL __ / N/A __   Open Sev-1: __  Sev-2: __
Declared done by: <QA lead>  on <date>
```

Bug reports must include the check ID (e.g. `[bash H5]`), steps, expected vs actual, tx hash if any, browser, wallet, and account G-address. **Never** include a secret key.

---

## 10. Dry-run log (test plan for #1850)

Run the checklist once end to end before the first real bash. Record anything ambiguous and fix the wording here.

| Date (UTC) | QA lead | Sections run | Ambiguous items fixed | Notes |
|---|---|---|---|---|
| _pending_ | | | | |

---

## Out of scope

Paid external QA, load testing (`backend/test/load`), mainnet, and the fiat on-ramp ([spike](FIAT_ONRAMP_SPIKE.md)).

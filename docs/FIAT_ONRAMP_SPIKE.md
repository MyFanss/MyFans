# Fiat On-Ramp Evaluation Spike

> Issue #1852. Status: **Proposed. Needs review sign-off (§9).**
> Owners: @MyFanss/backend (integration), @MyFanss/frontend (UX), maintainers (compliance and partner contracts).

The README says fans can get from fiat (card or bank) to a subscription through Stellar anchors and ramps (see *Why Stellar* and *Problems MyFans Solves → No fiat-friendly path*). The repo has no ramp code yet. If we pick a partner without evaluating the options, we take on compliance and UX debt that is hard to undo. This spike compares three integration shapes, threat-models them, and recommends an MVP split into follow-up issues.

**Out of scope:** obtaining a banking, money-transmitter or e-money licence. The recommendation is designed so that MyFans does **not** need one.

---

## 1. Constraints any option must satisfy

| # | Constraint | Why |
|---|---|---|
| C1 | **MyFans never sees, stores, or logs card PAN, CVV, or bank credentials.** Not in Postgres, logs, analytics, error trackers, or backups. | PCI DSS scope, breach impact. See [Postgres Backup/Restore](POSTGRES_BACKUP_RESTORE.md): anything in the DB lives in backups for up to 12 months. |
| C2 | **MyFans never takes custody of fan fiat or fan crypto.** Funds go from the partner straight to the fan's own Stellar address. | Custody makes us a money transmitter (licence is out of scope). |
| C3 | The subscription payment itself stays **on-chain and unchanged**: `subscribe(fan, plan_id)` signed by the fan's wallet ([contract interface](../contract/docs/interfaces/)). | One money path to audit. No off-chain "paid" flag that could bypass `is_subscriber`. |
| C4 | Delivered asset is one the subscription plans accept (XLM or USDC on Stellar). | Otherwise the fan needs a second swap step. |
| C5 | KYC and sanctions screening are performed **by the partner** under the partner's licence. | We are not the regulated entity. |
| C6 | Works on testnet or a partner sandbox for CI and the bug bash. | See [Bug Bash Checklist](BUG_BASH_CHECKLIST.md). |

---

## 2. Options evaluated

Partner names are examples of each integration shape, not endorsements. Coverage, fees, supported assets and sandbox availability change often. **Verify every row in §2.4 against the partner's current docs and contract before building.**

### Option A: SEP-24 anchor (hosted interactive deposit)

Stellar-native anchors expose [SEP-24](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md) (interactive deposit/withdraw), authenticated with [SEP-10](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) (the wallet proves it holds the account key). Discovery goes through the anchor's `stellar.toml` (SEP-1). Examples: USDC anchors and cash-in networks such as MoneyGram Access.

Flow: the frontend fetches the anchor's `stellar.toml`, does SEP-10 auth with the fan's wallet, then opens the anchor's hosted KYC/payment page in a popup or iframe. The anchor sends USDC to the fan's address. The fan then signs `subscribe` as normal.

- **Pros:** Stellar-native and open standard, so we can swap anchors without rewriting. Funds go straight to the fan's account. The anchor owns KYC and payment data. No partner SDK in our bundle.
- **Cons:** The fan must already have a wallet and a USDC **trustline** before deposit. Anchor UX varies widely. Many anchors are bank or cash only, not card. SEP-10 adds a second wallet signature.

### Option B: Card on-ramp widget (aggregator, delivers to a Stellar address)

Card-focused on-ramp providers (MoonPay/Transak-style widgets) sell XLM or USDC-on-Stellar by card, Apple Pay or Google Pay, and deliver to a destination address we pass in.

Flow: the backend creates a **signed widget URL** (partner API key kept server-side) with the fan's public key, asset and a suggested amount. The frontend opens the partner's hosted widget. The partner does KYC and card capture and sends funds on-chain. A partner webhook updates the ramp session status. The fan then signs `subscribe`.

- **Pros:** Best card UX and conversion. Widest jurisdiction coverage. The partner is merchant of record for the card transaction. Card data never touches our origin (hosted page, not our form).
- **Cons:** Proprietary API, so switching partners means rework (keep it behind an adapter). Minimum purchase amounts are often higher than a single month's subscription. Webhooks must be verified (see T5). Card-fraud chargebacks are handled by the partner, but can lead to frozen partner accounts or blocked fans.

### Option C: Platform-billed card (MyFans charges the card, then pays on-chain)

MyFans takes the card through a PSP (Stripe-style), then the backend pays the subscription from a platform hot wallet on the fan's behalf.

- **Pros:** Most familiar checkout. Fans do not need a wallet.
- **Cons:** Breaks **C2** (we hold funds and act as the payer) and **C3** (the on-chain subscriber is the platform, or we need an off-chain entitlement). This makes us a money transmitter in most jurisdictions, needs a hot wallet with signing keys, and adds reconciliation between card charges and on-chain state. **Rejected** for MVP. Revisit only with a licence strategy, which is out of scope.

### 2.4 Comparison

| Criterion | A: SEP-24 anchor | B: Card widget | C: Platform-billed |
|---|---|---|---|
| Card PAN touches MyFans (C1) | No | No | No (PSP tokenises), but PCI SAQ scope still applies |
| MyFans custody (C2) | No | No | **Yes** ❌ |
| On-chain `subscribe` unchanged (C3) | Yes | Yes | **No** ❌ |
| Payment methods | Mostly bank / cash, some card | Card, Apple/Google Pay, some bank | Card |
| Needs wallet first | Yes, plus a USDC trustline | Yes (destination address) | No |
| Extra signatures | SEP-10 auth + `subscribe` | `subscribe` only | None |
| KYC owner | Anchor | Partner | **MyFans / PSP** |
| Vendor lock-in | Low (open SEP) | Medium (adapter) | High |
| Sandbox / testnet | Many anchors run testnet (e.g. SDF test anchor) | Partner sandbox, usually mainnet-asset simulated | PSP test mode |
| Integration effort (est.) | M | S–M | L + compliance |
| Verdict | **Phase 2** | **MVP** | Rejected |

---

## 3. Recommendation

**MVP: Option B (card widget) behind a `fiatOnRamp` feature flag, default off, with a thin adapter so Option A can be added later without touching checkout.**

Reasoning:

1. The README promise is specifically "fans can pay with card". Only B delivers that at MVP cost without custody.
2. B and A share the same architecture: *partner delivers funds to the fan's address → fan signs `subscribe`*. Building B first gives us the adapter seam, session table and UX states that A will reuse.
3. C is rejected because it breaks C2 and C3 and requires a licence, which is out of scope.

Selection criteria for the specific B partner (decide in follow-up F1): supports **USDC on Stellar** (preferred over XLM to avoid price drift between purchase and `subscribe`), destination-address prefill, signed widget URLs, HMAC-signed webhooks, a sandbox, and a minimum purchase at or below the typical plan price. If no partner meets the minimum, the UX should suggest buying several months' credit.

---

## 4. Target architecture (MVP)

```
Fan browser                         MyFans backend                 Partner
───────────                         ──────────────                 ───────
[Top up with card] ──POST /v1/ramp/sessions {asset, amount}──►
                                    create ramp_session(pending)
                                    sign widget URL (API key server-side)
                   ◄────────── {widgetUrl, sessionId} ───────
open hosted widget (partner origin) ─────────────────────────────► KYC + card capture
                                                                   send USDC → fan G...
                                    ◄──── webhook (HMAC) ───────── status: completed, txHash
                                    verify sig, idempotent upsert
                                    verify txHash on Horizon: dest == fan, asset, amount
poll GET /v1/ramp/sessions/:id  ──►  {status: funds_arrived}
[Subscribe] → wallet signs subscribe(fan, plan_id)  → contract (unchanged)
```

Data we **may** store in `ramp_session`: session id, fan public key, partner name, partner order id, asset, requested amount, delivered amount, Stellar tx hash, status, timestamps.

Data we **must not** store: PAN, CVV, expiry, bank account or routing numbers, KYC documents, date of birth, government IDs, raw webhook bodies that contain any of these. Webhook payloads are parsed into an allowlist of fields. Nothing else is persisted or logged (extend [Log Redaction](../backend/docs/LOG_REDACTION.md) rules to the ramp module).

The "funds arrived" signal is always confirmed **on-chain via Horizon**, never from the webhook alone. The webhook only tells us when to look.

---

## 5. Threat model

Assets: fan funds in transit, the partner API key and webhook secret, fan PII, and the integrity of entitlement (`is_subscriber`).

| ID | Threat (STRIDE) | Scenario | Mitigation |
|---|---|---|---|
| T1 | Info disclosure | Card data or KYC PII ends up in our DB, logs, backups or error tracker | Hosted partner widget only, never our own card form. Allowlist-parse webhooks. Redaction rules. CI test asserting the `ramp_session` schema has no PAN-like columns. A bug bash item checks the logs. |
| T2 | Tampering | Attacker changes the destination address in the widget URL so funds go to them | The widget URL is **signed server-side**. The destination is taken from the authenticated session's wallet, never from the request body. The partner verifies the signature. |
| T3 | Spoofing | Forged webhook marks a session "completed" | HMAC signature check with a constant-time compare, timestamp tolerance (≤5 min), and replay protection by partner event id. **Also** confirm the tx hash on Horizon (destination, asset, amount ≥ expected). |
| T4 | Elevation | "Ramp completed" is treated as "subscribed", bypassing the contract | Entitlement stays solely `is_subscriber` via the indexer. The ramp module has no write path to subscriptions (C3). |
| T5 | Repudiation / DoS | Webhook floods or retries create duplicate sessions or double UX prompts | Idempotency on partner event id (see [Idempotency](../backend/docs/IDEMPOTENCY.md)). Rate-limit `POST /v1/ramp/sessions` per wallet ([Rate Limiting](../backend/docs/RATE_LIMITING.md)). |
| T6 | Info disclosure | Partner API key leaks through a `NEXT_PUBLIC_*` variable or the client bundle | The key is backend-only and lives in the secret manager ([Secret Management](../backend/docs/SECRET_MANAGEMENT.md)). A CI grep blocks `NEXT_PUBLIC_*RAMP*KEY`. |
| T7 | Tampering | Clickjacking or phishing clone of the widget | Open the partner widget in a popup or new tab on the partner origin. If embedded, restrict `frame-src` in CSP to the exact partner host ([CSP](../frontend/docs/CSP.md)). Never proxy the widget through our origin. |
| T8 | Fraud | Stolen card buys USDC, the fan subscribes, then the partner reverses or freezes | The chargeback is the partner's loss and liability. On-chain payment to the creator is final. Document for creators that ramp reversals do not claw back earnings. The partner may block the wallet, which is acceptable. |
| T9 | Price / slippage | XLM price moves between purchase and `subscribe`, so the fan is short | Prefer USDC. If XLM is used, quote a +2% buffer and let the UI show the shortfall. |
| T10 | Supply chain | Partner SDK script compromises our page | No partner JS on our origin (URL redirect or popup only). If an SDK is unavoidable, pin its version and use SRI. |

---

## 6. UX impact

- **New entry point:** a "Top up with card" button in checkout, only shown when the connected wallet's balance is below the plan price **and** `fiatOnRamp` is on **and** the jurisdiction is supported (§8).
- **The wallet is still required.** The ramp does not remove wallet onboarding. The MVP copy must say "You'll receive USDC in your wallet, then confirm the subscription." The walletless experience is out of scope for MVP.
- **Trustline:** if the fan's account lacks a USDC trustline, prompt a `changeTrust` signature *before* opening the widget. Otherwise the partner's payment fails (see §7).
- **States:** `idle → session_created → widget_open → pending_partner → funds_arrived → subscribe_ready`, plus `failed`, `expired` and `cancelled`. Reuse the [Pending page](../frontend/docs/PENDING_PAGE.md) patterns. Never show "Subscribed" until the indexer confirms it.
- **Two steps, two signatures:** fund, then subscribe. The funding step can take minutes (KYC). Keep the plan and creator context so the fan can come back later. Session status is persisted server-side.
- **Accessibility:** the partner widget's a11y is outside our control. Our own states must be screen-reader-announced (`aria-live`).

---

## 7. Edge cases and failure modes

| Case | Behaviour |
|---|---|
| **Jurisdiction not supported** by the partner (sanctioned countries, some US states, etc.) | Hide the button when the partner's country API or geo check says it is unsupported. If the partner rejects inside the widget, show "Card top-up isn't available in your region. You can still pay with XLM/USDC from any wallet." No IP-based blocking by MyFans beyond the partner's list, and no storing geo data. |
| **Creator's jurisdiction** differs from the fan's | Irrelevant to the ramp. Funds go to the fan, and the fan pays the creator on-chain. |
| Missing USDC trustline | Pre-check via Horizon. Prompt `changeTrust`. If skipped, block opening the widget. |
| Account not activated (0 XLM) | The partner may not be able to deliver. Pre-check and explain. Some partners send a small amount of XLM for activation, so verify in F1. |
| KYC rejected or abandoned | Session → `failed` or `expired` after the partner TTL. No retries from our side. Show the partner support link. |
| Webhook never arrives | Backend job polls the partner order API for sessions `pending_partner` for more than 15 min, until the partner TTL. Horizon check for incoming payments to the fan as a fallback. |
| Funds delivered but the fan never subscribes | Fine. The fan owns the funds. No refund flow is needed from us. |
| Partner delivers less than requested (fees) | The UI shows the delivered amount. If it is below the plan price, show the shortfall. |
| Contract **paused** | Hide top-up while `get_config().paused` is true, so fans don't buy funds they can't spend right now. |
| Testnet | Use the partner sandbox. The widget must never be enabled with a mainnet partner key on a testnet deployment (config assert at boot: network ↔ partner environment). |

---

## 8. Compliance notes

These are notes for the maintainers, not legal advice. Get counsel review before mainnet launch of the ramp.

- **Regulated party:** the partner (Option B) or anchor (Option A) is the regulated entity for KYC/AML, sanctions screening and the card transaction. MyFans is a referrer and integration surface. Confirm this in the partner agreement, including who is merchant of record.
- **No custody** (C2) keeps MyFans out of money-transmission and e-money scope in most jurisdictions. Any feature that routes fiat or crypto through a MyFans-controlled account reopens this and needs a new review.
- **PCI DSS:** with hosted widget or redirect only, and no card fields on our origin, we should be outside cardholder-data scope. Keep it that way: no card inputs, no partner iframes that post card data to our endpoints.
- **Data protection (GDPR/CCPA):** `ramp_session` holds a wallet address and order id. Treat them as personal data, include them in deletion-request handling, and set a retention period (proposal: 13 months, for tax and dispute windows).
- **Adult or creator content:** many ramp partners restrict merchant categories. Disclose the platform's content policy to the partner up front. Rejection here is a partner-selection blocker.
- **Tax:** delivered amounts are fan purchases, not creator income, so there are no creator tax implications from the ramp itself.
- **Marketing copy:** do not describe USDC as "dollars in your account", and do not imply MyFans holds balances.

---

## 9. Review sign-off

Acceptance for #1852 is this doc merged with the recommendation. Reviewers record their decision here in the PR.

| Role | Reviewer | Decision | Date |
|---|---|---|---|
| Backend lead | | | |
| Frontend lead | | | |
| Security reviewer (threat model §5) | | | |
| Maintainer (compliance §8, partner choice) | | | |

---

## 10. Follow-up issues (MVP split)

Create these as separate issues once the doc is signed off, and link them here.

| # | Title | Scope | Depends on |
|---|---|---|---|
| F1 | Ramp partner selection and sandbox account | Score 2–3 Option B partners against §3 criteria. Sign agreement. Get sandbox keys. | Sign-off |
| F2 | `fiatOnRamp` feature flag (backend + frontend) | Add to [Feature Flags](../backend/docs/FEATURE_FLAGS.md). Default `false`. High blast radius. | — |
| F3 | Backend `RampModule`: sessions + signed widget URL | `POST /v1/ramp/sessions`, `GET /v1/ramp/sessions/:id`, `ramp_session` table with no PAN/PII columns, secret-manager key. | F1, F2 |
| F4 | Backend ramp webhook + Horizon confirmation | HMAC verify, replay protection, idempotent upsert, Horizon tx check, polling fallback. | F3 |
| F5 | Frontend "Top up with card" checkout step | Balance check, trustline prompt, popup widget, state machine (§6), `aria-live`, CSP `frame-src` if embedded. | F3 |
| F6 | Jurisdiction and pause gating | Partner country API, hide when paused, copy for unsupported regions. | F3, F5 |
| F7 | Ramp security tests | Schema/log PAN guard, forged webhook, replayed webhook, tampered destination, key-in-bundle grep. | F3, F4 |
| F8 | Phase 2: SEP-24 anchor adapter (Option A) | SEP-1/10/24 behind the same adapter. Testnet anchor in CI. | F3–F5 |

Related: [Testnet Beta Runbook](TESTNET_BETA_RUNBOOK.md) (the ramp is **not** part of the testnet beta), [Mainnet Readiness Gate](MAINNET_READINESS.md) (a ramp enabled on mainnet adds gate items G-R1–G-R3).

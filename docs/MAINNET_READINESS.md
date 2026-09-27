# Mainnet Readiness Gate

> Issue #1854. **This is a go/no-go gate.** Mainnet contract deploys and fund-moving releases do not happen until every item below is **PASS** or has a signed written exception (§4).
> Owner: release manager. Final approvers: see §3.

Mainnet deploys are irreversible, and bugs in the money path lose real funds. This gate turns "are we ready?" into a list of **binary** items. Each item has a named verifier and a piece of evidence (a link, tx hash, log or screenshot) that a reviewer can check without asking anyone. "Mostly done" counts as **FAIL**.

Related: [SECURITY.md](../SECURITY.md) · [Contract Upgrade Governance](CONTRACT_UPGRADE_GOVERNANCE.md) · [Contract Deploy Runbook §5](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md#5-deploy-to-mainnet) · [Postgres Backup/Restore](POSTGRES_BACKUP_RESTORE.md) · [Testnet Beta Runbook](TESTNET_BETA_RUNBOOK.md) · [Bug Bash Checklist](BUG_BASH_CHECKLIST.md)

**Out of scope:** insurance and cover products, and the token generation event.

---

## 1. How to use this gate

1. The release manager opens a tracking issue **"Mainnet readiness: `<tag>`"** and copies §2 into it.
2. Each item's verifier sets it to **PASS**, **FAIL** or **EXCEPTION** and links the evidence. Nothing without evidence counts as PASS.
3. The evidence must be for the **exact tag and Wasm hashes** being deployed. If the code or Wasm changes after an item passed, every item marked 🔁 must be re-verified.
4. When every item is PASS or EXCEPTION, the approvers in §3 sign. Then the freeze window (§5) opens and the deploy may proceed.
5. After deploy, complete §6 (post-deploy verification) in the same issue.

---

## 2. Checklist

Legend: 🔁 = re-verify if code/Wasm changes after sign-off. Every item is PASS / FAIL / EXCEPTION.

### A. Code and audit

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| A1 🔁 | An external security audit of **all contracts being deployed** covers the exact commit or Wasm hashes being deployed | Security lead | Audit report link plus a table of audited Wasm hashes vs. deployed Wasm hashes (identical) |
| A2 🔁 | All audit findings rated Critical/High are fixed **and** the fix is re-reviewed by the auditor | Security lead | Finding → PR → auditor confirmation for each |
| A3 🔁 | Medium/Low findings are each fixed or have a written accept-risk note | Security lead | Findings table with status |
| A4 🔁 | Backend and frontend security review done (auth/JWT, CSRF, CSP, CORS, rate limits, secret handling) with no open High items | Security lead | Review doc. Links to [CSRF](../frontend/docs/CSRF.md), [CSP](../frontend/docs/CSP.md), [CORS & headers](../backend/docs/CORS_AND_SECURITY_HEADERS.md) |
| A5 🔁 | `contract/` workspace builds from a clean clone (`cargo metadata` succeeds, `deploy.sh --dry-run` passes for mainnet) | Contract lead | CI run link on the release tag |
| A6 🔁 | CI green on the release tag: contract tests, ABI snapshot / storage-key drift checks, backend and frontend tests, `security-audit.yml` | Release manager | CI run links |
| A7 | No open issues labelled `security` or `contract` + `release-blocker` | Release manager | Issue search link (empty) |
| A8 | The SECURITY.md reporting channel is working and monitored (test report received and acknowledged) | Security lead | Timestamped acknowledgement |

### B. Testnet proof

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| B1 🔁 | The release tag ran on testnet via the [Testnet Beta Runbook](TESTNET_BETA_RUNBOOK.md), with all gates passed | Release manager | Launch log |
| B2 🔁 | [E2E Testnet Path](E2E_TESTNET_PATH.md) §3 **and** §4 PASS on the release tag's Wasm | Contract lead | Verification log row + evidence |
| B3 | [Bug bash](BUG_BASH_CHECKLIST.md) finished with **zero open Sev-1/Sev-2** | QA lead | Bug bash result sheet |
| B4 | The testnet beta ran for at least 14 days with no unexplained contract state change | Release manager | Monitoring notes |

### C. Pause and emergency controls

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| C1 🔁 | Pause drill done **on mainnet-equivalent config** (testnet, same admin setup as mainnet, i.e. multisig): `pause` blocks `subscribe` with `Paused` (4), `unpause` restores it | Contract lead + witness | Tx hashes for pause, the failed subscribe, and unpause |
| C2 🔁 | Treasury `set_paused(true)` blocks `deposit`/`withdraw`, and `set_paused(false)` restores them | Contract lead + witness | Tx hashes |
| C3 🔁 | A non-admin `pause` / `set_protocol_fee` / treasury `withdraw` fails auth | Contract lead | Tx hashes or test output |
| C4 | Pause runbook: named on-call people who can reach the quorum of admin signers, with a measured decision → paused time **≤ 30 min** | Release manager | Drill timing + on-call roster |
| C5 | The frontend shows a clear error when the contract is paused (no stuck Pending) | Frontend lead | Screenshot |

### D. Admin keys and dual control

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| D1 | The mainnet **admin address is a Stellar multisig account**. No single key can meet the threshold alone. Recommended: 2-of-3 at medium threshold, with signers held by different people | Security lead | `stellar account` / Horizon output showing signers, weights, thresholds |
| D2 | Admin signer keys are hardware-backed or held in an HSM/KMS. None exists as a plaintext file on a laptop or CI runner | Security lead | Custody attestation per signer |
| D3 | The deployer key is different from the admin key, **or** admin is transferred to the multisig right after deploy (the deployer is then discarded) | Contract lead | Plan + post-deploy check in §6 |
| D4 | Signer rotation and lost-signer procedure is documented and rehearsed once on testnet | Security lead | Rehearsal tx hashes |
| D5 | Production secrets (JWT, webhook, DB, backup key) are fresh, in the secret manager, and not shared with testnet or staging ([Secret Management](../backend/docs/SECRET_MANAGEMENT.md)) | Platform lead | Secret-manager inventory (names only) |
| D6 | Any upgrade path follows [Contract Upgrade Governance](CONTRACT_UPGRADE_GOVERNANCE.md), and that doc is complete and reviewed | Contract lead | Doc link + reviewer |

### E. Fee caps and economic config

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| E1 🔁 | The deployed subscription Wasm enforces `MAX_FEE_BPS = 1000` (10%): `set_protocol_fee(1001)` reverts `FeeTooHigh` on testnet with the **same Wasm hash** | Contract lead | Tx hash of the revert + Wasm hash |
| E2 | The initial `protocol_fee_bps` value is agreed in writing, and is ≤ 1000 | Product + maintainers | Decision link |
| E3 | `fee_recipient` is the deployed mainnet **treasury** contract id, not an EOA | Contract lead | Planned value, then `get_config` in §6 |
| E4 | Treasury `withdraw` destination policy is agreed: who can withdraw, and where to | Maintainers | Policy link |
| E5 | Accepted assets for plans are listed (e.g. XLM SAC and USDC issuer), and issuer addresses are checked against official sources | Contract lead | Asset table with issuer G-addresses |

### F. Backups and restore

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| F1 | Production Postgres has PITR enabled plus a nightly encrypted logical dump to a separate account ([Backup/Restore §3](POSTGRES_BACKUP_RESTORE.md#3-backup-schedule)) | Platform lead | Provider config screenshot + first dump object |
| F2 | The weekly CI restore drill (`postgres-restore-drill.yml`) is green for the last 4 runs | Platform lead | Run links |
| F3 | **A manual production-shaped restore drill was done within the last 90 days** and met RTO ≤ 1 h ([Backup/Restore §9](POSTGRES_BACKUP_RESTORE.md#9-drills)) | Platform lead | Drill table row: date, artifact, measured RTO |
| F4 | Backup bucket has object lock or MFA delete, and the backup host can only `PutObject` | Platform lead | Bucket policy |
| F5 | The "no new backup in 26 h" alert is configured and was test-fired | Platform lead | Alert test screenshot |

### G. Monitoring and incident response

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| G1 | Dashboards exist for API 5xx, latency, `/v1/ready`, poller lag, and RPC errors ([Metrics & Grafana](../backend/docs/METRICS_GRAFANA.md)) | Backend lead | Dashboard links |
| G2 | Alerts page on-call for: `/v1/ready` failing > 5 min, poller lag > 100 ledgers for > 10 min, 5xx > 2% | Backend lead | Alert rules + test page |
| G3 | A contract state watcher alerts on any change to `paused`, `protocol_fee_bps`, `fee_recipient`, or admin | Contract lead | Rule + test alert |
| G4 | On-call rota covers the first 14 days after launch, 24/7, with contact details verified | Release manager | Rota link |
| G5 | Incident comms templates exist (status page / social / in-app), based on [Testnet Beta Runbook §8](TESTNET_BETA_RUNBOOK.md#8-invite-testers-and-communications) | Release manager | Template links |
| G6 | Log redaction verified: no JWTs, secrets or PII in production logs ([Log Redaction](../backend/docs/LOG_REDACTION.md)) | Security lead | Sample log query |

### H. Configuration parity

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| H1 | Every mainnet env var is set from the mainnet `contract-ids.json`, and `test-deploy-output.sh` passes with `"network": "mainnet"` | Contract lead | Script output |
| H2 | Feature flag values for mainnet are listed and approved. High-blast-radius flags are only on if they appear in E-series/B-series evidence ([Feature Flags](../backend/docs/FEATURE_FLAGS.md), [Staging parity](../frontend/STAGING_PARITY_CHECKLIST.md)) | Release manager | Flag table |
| H3 | CSP `connect-src` includes the mainnet RPC/Horizon hosts and **no** testnet hosts are configured for mainnet | Frontend lead | Response header capture |
| H4 | The frontend network guard refuses to sign on the wrong network ([Network Guard](../frontend/docs/NETWORK_GUARD.md)) | Frontend lead | Screenshot with wallet set to testnet |

### R. Only if a fiat on-ramp is enabled at launch

Skip these if `fiatOnRamp` is off. See [Fiat On-Ramp Spike](FIAT_ONRAMP_SPIKE.md).

| ID | Item (binary) | Verifier | Evidence |
|---|---|---|---|
| G-R1 | No PAN, CVV or bank credentials in DB schema, logs, or backups (schema check + log search) | Security lead | Query output |
| G-R2 | Webhook HMAC, replay protection, and Horizon tx confirmation have tests that pass | Backend lead | CI link |
| G-R3 | Partner agreement signed. The partner is the regulated entity for KYC/AML. Counsel review done | Maintainers | Agreement reference |

---

## 3. Sign-off roles

The deploy needs **all** of these signatures on the tracking issue, from **at least three different people**. Nobody may sign for a section they were the only verifier on **and** also be the final approver.

| Role | Signs for | Name | Signature (comment link) | Date |
|---|---|---|---|---|
| Contract lead | A5, B2, C, D3, D6, E1, E3, E5, G3, H1 | | | |
| Security lead | A1–A4, A8, D1, D2, D4, G6, G-R1 | | | |
| Platform lead | D5, F | | | |
| Backend lead | G1, G2, G-R2 | | | |
| Frontend lead | C5, H3, H4 | | | |
| Release manager | A6, A7, B1, B3, B4, C4, G4, G5, H2 | | | |
| **Final approver (maintainer)** | Overall go/no-go | | | |

---

## 4. Exceptions (waivers)

An item can only be waived with a **written exception** posted on the tracking issue before sign-off. The exception must include:

1. Item ID and why it can't pass now.
2. The concrete risk if we go ahead anyway, including worst-case funds at risk.
3. Compensating control (e.g. lower fee cap, launch with deposit limits, extra monitoring).
4. An expiry date or trigger by which the item must be PASS, plus a linked follow-up issue.
5. Approval from **two** people: the Security lead and the Final approver. Neither can be the person who asked for the exception.

**Never waivable:** A1, A2, C1, C3, D1, D2, E1, E3, F1. If any of these is not PASS, the answer is **no-go**.

An unwritten or verbal waiver counts as FAIL.

---

## 5. Freeze window

- **Starts** when the final approver signs §3 and lasts until §6 is complete (plus **72 h** of stable operation).
- During the freeze:
  - No merges to the release branch or tag except fixes for this gate. Each such fix resets every 🔁 item it touches.
  - No changes to production env, flags, secrets, or infrastructure except the planned deploy.
  - No dependency bumps. Pause Dependabot auto-merge ([Dependency Updates](DEPENDENCY_UPDATES.md)).
  - At least two of the D1 signers are reachable during the deploy.
- **Deploy window:** a weekday, in hours when the whole sign-off group is online. Not before a holiday. Not within 24 h of a known Stellar network upgrade.
- **Abort criteria:** any deploy step fails, any §6 check does not match, or a new Sev-1 appears. Then stop, pause if any contract is live, and re-open the gate.

---

## 6. Post-deploy verification (same tracking issue)

| ID | Check | Expected | Evidence |
|---|---|---|---|
| P1 | Deployed Wasm hashes | Equal to the audited hashes (A1) | `stellar contract info` / fetch output |
| P2 | `get_config` on subscription | `admin` = multisig (D1), `protocol_fee_bps` = E2 value ≤ 1000, `fee_recipient` = treasury id, `paused` = false | Output |
| P3 | Treasury and token admin | Multisig. The deployer has no remaining admin rights (D3) | Output |
| P4 | `contract-ids.json` (mainnet) validated and stored in a secure artifact store | `test-deploy-output.sh` exit 0 | Output + storage link |
| P5 | Small real subscription by a team member (minimum plan price) | Succeeds. Creator and treasury receive the correct split. `is_subscriber` = true. Backend confirms via poller | Tx hash |
| P6 | Alerts from G2/G3 are live against the mainnet ids | Test alert received | Screenshot |
| P7 | Pre-launch production DB backup taken | Object present | Object key |

---

## 7. Review of this document

This gate itself needs a security review before it is used (test plan for #1854).

| Reviewer | Role | Decision | Date |
|---|---|---|---|
| | Security lead | | |
| | Contract lead | | |

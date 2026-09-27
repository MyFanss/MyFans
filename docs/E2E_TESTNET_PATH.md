# End-to-End Testnet Proof Path

> Issue #1858. This is the product proof for the README's **Integration** milestone:
> **create plan → subscribe → access gated content**, on Stellar testnet, as one maintained path.
>
> Script: [`scripts/e2e-testnet/run-path.sh`](../scripts/e2e-testnet/run-path.sh) · Nightly (optional): [`e2e-testnet-nightly.yml`](../.github/workflows/e2e-testnet-nightly.yml)

The PR e2e suites ([`e2e-pr.yml`](../.github/workflows/e2e-pr.yml)) mock the RPC and the chain. This path runs against **real testnet contracts** and proves that on-chain gating works end to end. A short manual checklist covers the parts that need a browser wallet.

---

## 1. Owners

| Area | Owner | Responsible for |
|---|---|---|
| Path doc + script | @MyFanss/contract | Keeping §3 in sync with the subscription contract interface |
| Testnet deployment | @MyFanss/contract | A deployed, initialised, unpaused subscription contract ([Deploy Runbook](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md)) |
| Backend gating check | @MyFanss/backend | `GET /creators/:id/access` never returns `contentCid` without access |
| Manual UI checklist | @MyFanss/frontend | §4 steps still match the UI |
| Verification log | Release manager | A fresh §6 entry before each release, and at least monthly |

## 2. Prerequisites

- A **testnet** subscription contract, deployed and `init`-ed. See the [Deploy Runbook §4](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md#4-deploy-to-testnet). Its id is `CONTRACT_ID_SUBSCRIPTION` in `contract/.env.deployed`.
- `stellar-cli` (`cargo install --locked stellar-cli`, or a release binary) and `curl`.
- Friendbot reachable (`https://friendbot.stellar.org`).
- For the UI checklist: backend and frontend running against the same contract ([Local Quickstart](../frontend/docs/LOCAL_QUICKSTART.md), [API Quickstart](../backend/docs/API_QUICKSTART.md)), plus the Freighter wallet set to **Testnet** ([Wallet Setup](../frontend/docs/WALLET_SETUP.md)).

**Throwaway accounts only.** The script generates fresh creator, fan and outsider keys in a temporary keystore, funds them with friendbot, and deletes the keystore on exit. Never use a real, admin, or deployer key for this path. For the manual checklist, create new Freighter accounts just for testing.

## 3. Automated path (contract level)

```bash
SUBSCRIPTION_CONTRACT_ID=C... scripts/e2e-testnet/run-path.sh
# optional backend anonymous-gating check:
SUBSCRIPTION_CONTRACT_ID=C... API_URL=http://localhost:3001 API_CREATOR_ID=<creator id> \
  scripts/e2e-testnet/run-path.sh
```

| # | Step | Call (as) | Expected |
|---|---|---|---|
| 0 | Preflight | RPC `getHealth`; fetch contract Wasm (hash recorded); `get_config` | Healthy, initialised, not paused |
| 1 | Creator creates a plan | `create_plan(creator, native XLM SAC, 1 XLM, 17280 ledgers)` (creator) | Returns a `plan_id`; `get_plan` shows the creator |
| 2 | Gated before paying | `is_subscriber(fan, creator)` | `false` |
| 3 | Fan subscribes and pays | `subscribe(fan, plan_id)` (fan) | Success; XLM moves fan → creator, with the fee going to the treasury |
| 4 | Access granted, only to the payer | `is_subscriber(fan, creator)` / `is_subscriber(outsider, creator)` | `true` / `false` |
| 5 | Backend does not leak content *(optional)* | `GET {API_URL}/creators/{API_CREATOR_ID}/access`, anonymous | `"contentCid": null` |
| 6 | Cancel revokes access | `cancel(fan, creator)` (fan), then `is_subscriber` | `false` |
| — | Upgrade guard | Re-fetch the Wasm hash | Same as at the start |

Evidence goes to `e2e-evidence/<UTC stamp>/`:

- `evidence.md`: a table of every step, with expected and actual values, public keys, plan id, Wasm hashes, and the result.
- `cli.log`: raw CLI output, containing no secret keys.

`e2e-evidence/` is local output and should not be committed. Attach it to the verification log entry (§6) or keep the CI artifact.

### Exit codes

| Code | Meaning | Action |
|---|---|---|
| 0 | **PASS** | Record in §6 |
| 1 | **FAIL**: assertion failed | Real regression. Go to [Triage](#triage) |
| 2 | Config or tooling error (missing or unknown contract id, no CLI, mainnet passphrase) | Fix the environment |
| 10 | **INCONCLUSIVE**: friendbot empty or rate-limited, or RPC down | Retry later. Friendbot limits are per IP, so try another network, or pre-fund throwaway keys by hand |
| 11 | **INCONCLUSIVE**: contract not initialised or paused | Check with the contract owner. A pause may be intentional |
| 12 | **INCONCLUSIVE**: contract Wasm changed mid-run (upgrade) | Rerun after the upgrade finishes. Plans from before the upgrade may no longer be valid |

## 4. Manual remainder (UI + authenticated access)

The script cannot sign in a browser wallet or complete the backend's wallet-signed challenge login, so these steps are manual. Use two **new** Freighter testnet accounts (creator, fan), funded with friendbot.

- [ ] **Creator sign-in.** Connect Freighter as the creator. The challenge → verify login succeeds and the dashboard loads.
- [ ] **Create plan (UI).** Create a plan in the creator dashboard and approve the tx in Freighter. The plan appears in the dashboard and in `GET /plans?creator=<address>`.
- [ ] **Gated content published.** Publish a post or content item marked subscribers-only.
- [ ] **Fan sees a teaser only.** Open the creator page as the fan, before subscribing. Only the teaser is visible, and `GET /creators/:id/access` returns `hasAccess: false, contentCid: null`.
- [ ] **Subscribe (UI).** Subscribe and approve in Freighter. Checkout goes from `Pending` to confirmed once the poller indexes the event ([Event Indexing](../backend/docs/EVENT_INDEXING.md)).
- [ ] **Access granted.** Reload. The full content is visible, and `/access` returns `hasAccess: true` with a `contentCid`.
- [ ] **Other user still gated.** In a private window or a third account, only the teaser is shown.
- [ ] **Cancel.** Cancel from the fan's subscriptions page. Access is revoked after the event is indexed.

Record the network, contract id, public keys, tx hashes (from Freighter or stellar.expert) and screenshots in the §6 entry.

## 5. Nightly job (optional)

[`e2e-testnet-nightly.yml`](../.github/workflows/e2e-testnet-nightly.yml) runs §3 daily at 03:30 UTC and on manual dispatch.

- **Enable it** by setting the repository **variable** `TESTNET_SUBSCRIPTION_CONTRACT_ID`. Optionally also set `TESTNET_RPC_URL`, `TESTNET_API_URL` and `TESTNET_API_CREATOR_ID`. These are public ids, not secrets, and no signing key is ever given to the job.
- **Unconfigured**, the job is skipped with a notice and never goes red.
- An **INCONCLUSIVE** run (exit codes 10, 11, 12) gives a green job with a warning, so testnet flakiness doesn't page anyone.
- A **FAIL** makes the job red. Evidence is uploaded as an artifact for 30 days.

Each run creates a plan and a subscription on testnet and uses about 3 friendbot fundings. That is acceptable on testnet. Testnet resets periodically, so after a reset, redeploy (Deploy Runbook) and update the variable.

### Triage

1. Open the run summary, which contains the evidence table, and the `cli.log` artifact.
2. **Step 1 or 3 reverts**: compare the contract error code with the `Error` enum in `contract/contracts/subscription/src/lib.rs`. Examples: `Paused = 4`, `PlanInactive = 9`, `InsufficientBalance = 13`.
3. **Step 4 or 6 returns the wrong value**: this is a gating regression. Treat it as release-blocking and open an issue labelled `contract` with the evidence attached.
4. **Step 5 fails**: the backend leaked `contentCid`. This is security-relevant, so follow [SECURITY.md](../SECURITY.md).
5. **Interface changed** (for example, renamed args): update §3 and `run-path.sh` in the same PR as the contract change.

## 6. Verification log

Add a row after each verified run. Link the CI run or attach local evidence. Acceptance for #1858 requires at least one verified run in which **both** §3 and §4 pass.

| Date (UTC) | Who | Contract id | Automated (§3) | Manual (§4) | Evidence |
|---|---|---|---|---|---|
| _pending first run_ | | | | | |

## 7. Out of scope

- Mainnet and paid traffic. The script refuses the mainnet passphrase.
- Load or performance testing (see `backend/test/load`).
- Fiat on-ramp (anchor) flows.

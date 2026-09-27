# Testnet Beta Launch Runbook

> Issue #1853. Audience: a **maintainer** (or a fork maintainer) launching a MyFans testnet beta from a clean checkout.
> Owner: release manager for the beta. Contract steps: @MyFanss/contract. Backend/worker steps: @MyFanss/backend. Frontend steps: @MyFanss/frontend.

This runbook puts the launch steps in order and links to the detailed docs instead of repeating them. Do the phases **in order** and tick each box. Every phase ends with a **gate**. Do not start the next phase until the gate passes. If a gate fails, go to [§9 Rollback](#9-rollback).

> **Testnet only.** Never use mainnet keys, mainnet RPC, or funded mainnet accounts anywhere in this runbook. Mainnet launch is out of scope. It is governed by [MAINNET_READINESS.md](MAINNET_READINESS.md).

Detailed references:

- [Contract Deploy Runbook](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md): build, deploy, `contract-ids.json`
- [Deployed env variables](../contract/docs/DEPLOYED_ENV.md): canonical names and aliases
- [QUICKSTART](../QUICKSTART.md): local stack and Freighter setup
- [Feature Flags](../backend/docs/FEATURE_FLAGS.md): poller and other flags
- [E2E Testnet Path](E2E_TESTNET_PATH.md): automated plan → subscribe → gated proof
- [Bug Bash Checklist](BUG_BASH_CHECKLIST.md): beta quality pass

---

## 0. Roles and timeline

| Role | Responsibility | Name |
|---|---|---|
| Release manager (RM) | Runs this doc, owns go/no-go, sends comms | |
| Contract operator | Holds the testnet admin key, runs deploy, pause drill | |
| Backend operator | Env wiring, migrations, poller worker | |
| Frontend operator | Frontend env and deploy, CSP check | |
| Observer | Watches monitoring during launch (§7) | |

The same person may hold several roles on a small fork, **except** that the pause drill (§6) must be witnessed by a second person.

Suggested timeline: T-3 days freeze and dry-run (§10) → T-0 phases 1–7 (about 2–3 h) → T+0 invites (§8) → T+1 to T+14 bug bash.

---

## 1. Preflight (T-1 day)

- [ ] `main` is green in CI (`ci.yml`, `security-audit.yml`). Record the commit SHA you will deploy: `________`.
- [ ] Tag it: `git tag testnet-beta-<n> <sha> && git push origin testnet-beta-<n>`. Every later step uses **this tag**, not a moving `main`.
- [ ] **Contract workspace resolves:**
  ```bash
  cd contract && cargo metadata --no-deps --format-version 1 >/dev/null && echo OK
  ```
  This fails if `contract/Cargo.toml` lists a workspace member whose folder is missing. Fix the workspace in a PR and re-tag. **Do not** hand-edit `Cargo.toml` on the deploy machine.
- [ ] **Deploy dry-run passes** ([Deploy Runbook §3](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md#3-build-and-validate-wasm-artifacts)):
  ```bash
  ./contract/scripts/deploy.sh --network testnet --source myfans-deployer --dry-run
  ```
  Every package in `deploy.sh`'s `PACKAGES` list must build and verify. If the script lists a contract that the workspace does not contain, the dry-run fails. Treat that as a blocker, not a warning.
- [ ] Tools: `stellar --version`, `rustc --version`, `docker compose version`, Node 20+.
- [ ] Testnet RPC is healthy: `curl -s -X POST https://soroban-testnet.stellar.org -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'` returns `"status":"healthy"`.
- [ ] Check the Stellar status page for a planned **testnet reset**. Do not launch within 72 h of one, because a reset wipes every contract and account.

**Gate 1:** workspace resolves, dry-run passes, RPC healthy, no imminent reset.

---

## 2. Admin key handling

The testnet admin key controls `pause`/`unpause`, `set_protocol_fee` and treasury `withdraw`. Testnet funds are worthless, but a leaked admin key still lets anyone pause the beta or redirect fees. Practise the same hygiene you will need on mainnet.

- [ ] Generate a **dedicated** beta identity. Do not reuse a personal or CI key:
  ```bash
  stellar keys generate myfans-beta-admin --network testnet --fund
  stellar keys public-key myfans-beta-admin   # record: G________
  ```
- [ ] Store the secret in the team secret manager (entry `testnet/beta/admin`). Only the contract operator and RM have read access.
- [ ] The key **never** goes into: the repo, `backend/.env`, `frontend/.env.local`, CI variables, chat, or screenshots. The backend and frontend need contract **ids**, never the admin secret.
- [ ] Deploy with `--source myfans-beta-admin`. `deploy.sh` initialises every contract with the source account as admin.
- [ ] After launch, remove the identity from any shared machine: `stellar keys rm myfans-beta-admin`. Re-import it from the secret manager only for the pause drill or rollback.
- [ ] If the key is exposed: pause (§6), redeploy with a new identity (§9 R3), and post a notice using the incident template (§8.3).

---

## 3. Deploy contracts (order matters)

```bash
git checkout testnet-beta-<n>
./contract/scripts/deploy.sh \
  --network testnet \
  --source myfans-beta-admin \
  --no-fund \
  --non-interactive \
  --out contract/deployed-testnet.json \
  --env-out contract/.env.deployed-testnet
```

`deploy.sh` deploys in dependency order: **token → creator-registry → treasury → subscription → content-access → earnings**. Then it initialises each one and runs smoke view calls. The subscription contract is initialised with `--fee-bps 0` and `--fee-recipient <treasury id>`.

### Partial deploy (script failed part-way)

Soroban deploys can't be undone, and `deploy.sh` does **not** resume. If it exits non-zero after deploying some contracts:

1. **Do not wire any ids.** A half-deployed set may point subscription at a token or treasury from a different run.
2. Save the console log and any partial `deployed-testnet.json` as evidence.
3. Find the cause (friendbot limit, RPC timeout, init failure). Fix it.
4. **Re-run the whole script from the start.** It deploys a completely fresh set. The orphaned contracts from the failed run are harmless on testnet. Record their ids in the launch log as `abandoned`.
5. Never mix ids from two runs.

### Materialise and validate ids

- [ ] Write `contract/contract-ids.json` from the env output, exactly as in [Deploy Runbook §4](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md#write-the-canonical-contract-idsjson). Include the treasury id if your tooling reads it.
- [ ] `./contract/scripts/test-deploy-output.sh contract/contract-ids.json` exits 0.
- [ ] Manual verification ([Deploy Runbook §6](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md#6-post-deploy-verification)): `is-paused` → `false`, token `admin` → your admin G-address.
- [ ] Confirm the fee config:
  ```bash
  source contract/.env.deployed-testnet
  stellar contract invoke --id "$CONTRACT_ID_SUBSCRIPTION" --network testnet \
    --source myfans-beta-admin --send no -- get_config
  ```
  Expect `protocol_fee_bps` ≤ 1000, `fee_recipient` == `$CONTRACT_ID_TREASURY`, `paused` == false.
- [ ] Record every id and the Wasm hash in the launch log (§11).

**Gate 3:** full deploy succeeded in one run, `contract-ids.json` validates, and `get_config` matches expectations.

---

## 4. Set ids in backend and frontend

Use the **canonical** names from [DEPLOYED_ENV.md](../contract/docs/DEPLOYED_ENV.md). The deploy env output also writes the legacy aliases.

### Backend (secret manager or `backend/.env`)

- [ ] `STELLAR_NETWORK=testnet`
- [ ] `SOROBAN_RPC_URL=<testnet RPC>` (the same value as `STELLAR_RPC_URL` in the deploy env)
- [ ] `CONTRACT_ID_MYFANS_TOKEN`, `CONTRACT_ID_CREATOR_REGISTRY`, `CONTRACT_ID_TREASURY`, `CONTRACT_ID_SUBSCRIPTION`, `CONTRACT_ID_CONTENT_ACCESS`, `CONTRACT_ID_EARNINGS`
- [ ] `CORS_ORIGINS` set to the beta frontend origin only ([CORS & Security Headers](../backend/docs/CORS_AND_SECURITY_HEADERS.md))
- [ ] JWT and other secrets set per [Secret Management](../backend/docs/SECRET_MANAGEMENT.md). Use fresh beta values, not dev defaults.
- [ ] Leave `FEATURE_SOROBAN_POLLER` **unset or `false`** for now. It is enabled in §5.

### Frontend (`frontend/.env.local` or host env)

- [ ] `NEXT_PUBLIC_STELLAR_NETWORK=testnet`
- [ ] `NEXT_PUBLIC_API_URL=<beta backend origin>`
- [ ] `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_HORIZON_URL` set to testnet endpoints
- [ ] `NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID`, `NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID`, `NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID`, `NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID`, `NEXT_PUBLIC_EARNINGS_CONTRACT_ID`
- [ ] High-blast-radius flags stay **off** unless the beta scope explicitly includes them: `earnings_withdrawals`, `newSubscriptionFlow`, `cryptoPayments`, `shortLivedAccessTokens`. Record the chosen flag values in the launch log.

> [QUICKSTART](../QUICKSTART.md) §3 still shows `VITE_*` / `CONTRACT_ID` names. The Next.js frontend reads `NEXT_PUBLIC_*` (see `frontend/src/lib/contract-config.ts`), and the backend reads the canonical names above. Follow DEPLOYED_ENV.md when they disagree.

### Deploy the apps

- [ ] Run migrations: `cd backend && npm run migration:run`.
- [ ] Deploy the API and frontend (or `docker compose up -d --build postgres redis api frontend`) **without** the `workers` profile.
- [ ] `GET <api>/v1/health` → 200 and `GET <api>/v1/ready` → 200.
- [ ] Open the frontend with devtools open. There should be **no CSP violations** for RPC/Horizon ([CSP](../frontend/docs/CSP.md)). A violation here usually means a wrong or non-default RPC host.
- [ ] The frontend's contract ids match the backend's. Compare the subscription id in the network tab with `CONTRACT_ID_SUBSCRIPTION`.

**Gate 4:** API healthy and ready, frontend loads with no CSP errors, and ids match across contract, backend and frontend.

---

## 5. Enable the poller

The poller indexes subscription events into Postgres. The backend's fast `is subscriber?` checks and the checkout `Pending → confirmed` transition depend on it. It is enabled last so that it never indexes against wrong ids.

- [ ] Set `FEATURE_SOROBAN_POLLER=true` for the worker only. In production mode the flag stays off unless both RPC and contract are configured ([Feature Flags](../backend/docs/FEATURE_FLAGS.md)).
- [ ] Start the worker: `docker compose --profile workers up -d worker-poller` (or your platform's equivalent, `node dist/main --worker=poller`).
- [ ] Run **one** poller worker. Several pollers against the same cursor waste RPC quota and make lag metrics hard to read.
- [ ] Worker healthcheck is green, and logs show it polling `CONTRACT_ID_SUBSCRIPTION` from the expected start ledger.
- [ ] Run the automated proof path against the new contract:
  ```bash
  SUBSCRIPTION_CONTRACT_ID=$CONTRACT_ID_SUBSCRIPTION API_URL=<api> API_CREATOR_ID=<id> \
    scripts/e2e-testnet/run-path.sh
  ```
  Exit code 0 means PASS. For 10/11/12 (inconclusive), see [E2E Testnet Path §3](E2E_TESTNET_PATH.md#exit-codes).
- [ ] Do one manual subscribe in the UI with a throwaway Freighter account. Checkout reaches **confirmed** within 2 minutes. That proves the poller → DB → UI path works.
- [ ] Set the GitHub repo variable `TESTNET_SUBSCRIPTION_CONTRACT_ID` to the new id so the nightly job ([`e2e-testnet-nightly.yml`](../.github/workflows/e2e-testnet-nightly.yml)) follows this deployment.

**Gate 5:** e2e path PASS, the manual subscribe is confirmed through the poller, and the nightly job points at the new id.

---

## 6. Pause drill (mandatory before invites)

This proves the emergency stop works on **this** deployment, with **this** key, before any real users arrive. It needs a second person as witness.

1. [ ] Re-import the admin key from the secret manager.
2. [ ] Pause the subscription contract:
   ```bash
   stellar contract invoke --id "$CONTRACT_ID_SUBSCRIPTION" --network testnet \
     --source myfans-beta-admin -- pause
   ```
3. [ ] `get_config` shows `paused: true`.
4. [ ] Try to subscribe with a throwaway fan (UI or CLI). It **must revert** with `Paused` (error code 4). The UI shows a clear error, not a spinner stuck on Pending.
5. [ ] Existing subscriptions still read correctly: `is_subscriber` for the §5 fan still returns `true`.
6. [ ] Pause the treasury too: `-- set_paused --paused true`. Then `-- is_paused` → `true`.
7. [ ] Unpause both (`-- unpause` and `-- set_paused --paused false`). Subscribe works again.
8. [ ] Try `pause` with a **non-admin** identity. It **must fail** auth.
9. [ ] Record timings (decision → paused on-chain) and the witness name in the launch log. Target: under 5 minutes from decision.
10. [ ] `stellar keys rm myfans-beta-admin` on the operator machine.

**Gate 6:** pause blocks subscribe, unpause restores it, a non-admin can't pause, and the drill is witnessed.

---

## 7. Monitoring checklist

Leave this running for the whole beta. The Observer checks it at launch, then daily.

| Signal | Where | Healthy | Action if not |
|---|---|---|---|
| API liveness / readiness | `GET /v1/health`, `GET /v1/ready` | 200 | Check deploy logs, DB and Redis |
| Poller lag | Poller metric ([Metrics & Grafana](../backend/docs/METRICS_GRAFANA.md)) | < 100 ledgers behind tip | Check RPC health and worker logs. Restart the worker once, then escalate |
| Poller errors | Worker logs | No repeated RPC errors | RPC rate limit → lower the poll frequency or change provider |
| 5xx rate | API metrics / logs | < 1% | Triage. Roll back the app (§9 R1) if it came from a release |
| CSP violations | `NEXT_PUBLIC_CSP_REPORT_URI` endpoint, if configured | None | Check RPC hosts in CSP ([CSP](../frontend/docs/CSP.md)) |
| Contract state | `get_config` daily | `paused: false`, fee and recipient unchanged | Unexpected change means a possible key compromise. Pause and start an incident |
| Nightly e2e | `e2e-testnet-nightly.yml` | Green (inconclusive allowed) | Red means a gating regression. See [E2E triage](E2E_TESTNET_PATH.md#triage) |
| DB backups | [Postgres Backup/Restore](POSTGRES_BACKUP_RESTORE.md) staging tier | Nightly dump present | Fix before inviting more users |
| Testnet reset notice | Stellar status / developer channels | None scheduled | Plan redeploy (§9 R3) and warn testers |

---

## 8. Invite testers and communications

- [ ] Gates 1–6 passed and are recorded in the launch log.
- [ ] Bug bash roles assigned ([Bug Bash Checklist](BUG_BASH_CHECKLIST.md)).
- [ ] Invite the first wave (suggested: 10–20 people), then widen after 48 h without Sev-1/Sev-2 bugs.
- [ ] Pin a feedback channel and a bug issue template link.

### 8.1 Invite template

```
Subject: MyFans testnet beta — you're invited

MyFans is live on Stellar TESTNET for a closed beta.

• App: <frontend URL>
• Network: Stellar Testnet ONLY. Set Freighter to "Testnet".
  Never use a mainnet wallet or real funds. Testnet XLM is free from friendbot.
• Supported wallet: Freighter (Lobstr and WalletConnect are not guaranteed).
• Setup guide: <link to QUICKSTART.md>
• What to test: <link to BUG_BASH_CHECKLIST.md>
• Report bugs: <issue template link>. Include tx hash, browser and wallet.
• Known limits: testnet may reset and wipe all data. Subscriptions and
  content from the beta will not carry over to mainnet.

Beta window: <start> – <end>. Thank you!
```

### 8.2 Maintenance / pause notice

```
[MyFans beta] Subscriptions temporarily paused (<UTC time>)
We've paused new subscriptions while we investigate <short reason>.
Existing access is unaffected. Next update by <UTC time>.
```

### 8.3 Incident / rollback notice

```
[MyFans beta] Incident: <title> (<UTC time>)
Impact: <who/what>. Status: <investigating | mitigated | resolved>.
Action for testers: <none | reconnect wallet | re-subscribe after redeploy>.
Next update by <UTC time>.
```

### 8.4 Testnet reset / redeploy notice

```
[MyFans beta] Redeploy on <date>
Stellar testnet <is resetting | we are redeploying contracts>. All testnet
subscriptions and plans will be gone. Please re-fund with friendbot and
re-create plans/subscriptions after <UTC time>.
```

---

## 9. Rollback

Deployed Soroban contracts are immutable. "Rolling back" contracts means **pausing**, then deploying a fresh set and re-pointing the ids. The apps can be rolled back normally.

| ID | Situation | Steps |
|---|---|---|
| **R0** | Any money-path or gating bug under investigation | Pause subscription and treasury (§6 steps 1–2 and 6). Send notice 8.2. Keep the apps up so existing access still works. |
| **R1** | Bad backend or frontend release | Redeploy the previous image or tag. If a migration was involved, restore from the pre-migration dump ([Postgres Backup/Restore §6](POSTGRES_BACKUP_RESTORE.md#6-restore-decision-tree)). Contract ids are unchanged. |
| **R2** | Wrong ids wired (backend ≠ frontend ≠ `contract-ids.json`) | Stop `worker-poller` **first** so it doesn't index the wrong contract. Fix the env from `contract/.env.deployed-testnet`. Redeploy the apps. Truncate `subscription_index` and reset the poller cursor ([Event Indexing](../backend/docs/EVENT_INDEXING.md)). Restart the poller. |
| **R3** | Contract bug, admin key compromised, or testnet reset | Pause (R0) if the contract is still alive. Tag a fixed commit. Run §1 → §6 again with a **new** admin identity. Stop the poller, wire the new ids, and reset the index (as in R2). Update `TESTNET_SUBSCRIPTION_CONTRACT_ID`. Send notice 8.4. Old contracts stay paused and abandoned. Record them in the launch log. |
| **R4** | Poller storm or RPC quota exhaustion | Set `FEATURE_SOROBAN_POLLER=false` or stop `worker-poller`. The API keeps serving, but checkout confirmations will lag. Fix, then re-enable (§5). |

After any rollback: re-run the e2e path (§5) and one manual subscribe before lifting the pause or sending the "resolved" notice.

---

## 10. Maintainer dry-run (test plan for #1853)

Before the real launch, a maintainer who did **not** write this doc runs §1–§6 and §9 R2 end to end on testnet with throwaway identities. They then fill in the row below and fix any step that was unclear in the same PR.

| Date (UTC) | Maintainer | Tag / SHA | Phases completed | Time taken | Doc issues found | Result |
|---|---|---|---|---|---|---|
| _pending_ | | | | | | |

---

## 11. Launch log template

Copy into the beta tracking issue.

```
Tag / SHA:
Admin public key (G...):
Contract ids: token= registry= treasury= subscription= content-access= earnings=
Subscription Wasm hash:
Abandoned ids (partial deploys):
Flag values (backend / frontend):
Gate 1 ☐  Gate 3 ☐  Gate 4 ☐  Gate 5 ☐  Gate 6 ☐   (time + initials each)
Pause drill: decision→paused = __ min, witness =
E2E run: exit code __, evidence link
Invites sent (UTC), wave size:
```

---

## Out of scope

Mainnet deployment and token generation event. See [Mainnet Readiness Gate](MAINNET_READINESS.md). The fiat on-ramp is not part of the testnet beta ([Fiat On-Ramp Spike](FIAT_ONRAMP_SPIKE.md)).

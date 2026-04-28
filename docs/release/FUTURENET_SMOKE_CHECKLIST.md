# Futurenet Smoke – Manual Checklist

This workflow is **manual-only** (`workflow_dispatch`). It never runs on push or
pull_request, so it cannot block PR CI.

## How to trigger

1. Go to **Actions → Futurenet Smoke (manual) → Run workflow**.
2. Optionally override the `stellar_cli` version (default `25.2.0`).
3. Click **Run workflow**.

## What it does

| Step | Description |
|------|-------------|
| Build | Compiles all five contracts to WASM (`myfans-token`, `creator-registry`, `subscription`, `content-access`, `earnings`) |
| Deploy | Deploys each contract to Futurenet using a fresh ephemeral identity (`ci-<run_id>-<attempt>`) |
| Init | Initialises each contract in dependency order |
| Smoke | Calls read-only methods (`admin`, `is-paused`, `has-access`) and asserts expected values |
| Artifacts | Uploads `deployed-futurenet-smoke.json` and `.env.deployed-futurenet-smoke` (7-day retention) |

## Pass criteria

- All five contracts deploy without error.
- `token.admin` returns the deployer public key.
- `subscription.is-paused` returns `false`.
- `content-access.has-access` returns `false` for the deployer self-check.
- `earnings.admin` returns the deployer public key.
- Artifacts are uploaded and downloadable from the run summary.

## Concurrency

Only one smoke run executes at a time (`concurrency: futurenet-smoke`,
`cancel-in-progress: false`). A second trigger will queue until the first
finishes.

## Relationship to PR CI

The `ci.yml` workflow (triggered on push/PR) only runs `cargo build` and
`cargo test` for contracts — it does **not** deploy to any network. Futurenet
deploy is intentionally gated behind this manual workflow.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `stellar: command not found` | CLI cache miss + install failed | Re-run; cache will rebuild |
| `Unable to locate wasm for package` | Build failed silently | Check the "Build" step logs |
| `SMOKE FAIL: token.admin` | Init call failed or wrong contract deployed | Check "initializing" step logs |
| Futurenet RPC timeout | Network instability | Re-trigger the workflow |

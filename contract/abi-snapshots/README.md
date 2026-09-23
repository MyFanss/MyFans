# ABI Snapshots

Each `.json` file here is a snapshot of a contract's public ABI (generated via
`stellar contract inspect --output json`). They are committed to the repo so CI
can detect accidental breaking changes.

## How CI uses these

The `ABI Snapshot Check` GitHub Actions job runs:

```bash
./scripts/snapshot-abi.sh --check
```

It rebuilds every contract WASM, re-generates the ABI, and diffs it against the
committed snapshot. If anything changed, the job fails and reports the diff so
the change cannot land silently. The companion `Interface Docs Drift` job runs
`./scripts/check-interface-docs-drift.mjs` and fails when a contract interface
changed without a matching docs update.

Both jobs are required checks on protected branches. Their exact names are
listed in `contract/docs/BRANCH_PROTECTION.md`; keep that file in sync if the
job names ever change.

You can also run the same verification manually before opening a PR:

```bash
cd contract
./scripts/snapshot-abi.sh --check
node ./scripts/check-interface-docs-drift.mjs
```

## Intentionally updating a snapshot

1. Make your contract change.
2. Regenerate snapshots locally:
   ```bash
   cd contract
   ./scripts/snapshot-abi.sh
   ```
3. Update the interface docs for any added, renamed, or removed methods and
errors so the drift check passes.
4. Commit the updated `.json` files. **The commit message must include
   `abi-update: <reason>`** so the change is traceable in git history, e.g.:
   ```
   abi-update: add pagination params to content-likes list function
   ```
5. Open a PR — reviewers will see the exact ABI diff in the changed files.

## Regenerating snapshots manually

If you intentionally changed a contract interface and want to refresh the
committed snapshots:

```bash
cd contract
./scripts/snapshot-abi.sh
```

## Failure modes to watch for

- **Additive method without a snapshot update** — the ABI diff job fails; run
  `./scripts/snapshot-abi.sh` and commit the refreshed snapshot.
- **Renamed method** — both the ABI diff and the interface-docs drift check
  fail; update the snapshot and the docs together.
- **Docs missing a new error** — the interface-docs drift check fails; add the
  error to the interface docs before merging.

Never commit a stale snapshot to silence CI: a snapshot that does not match the
built contract hides real interface changes from reviewers.

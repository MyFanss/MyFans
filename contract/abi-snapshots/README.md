# ABI Snapshots

Each `.json` file here is a snapshot of a contract's public ABI (generated via
`stellar contract inspect --output json`). They are committed to the repo so CI
can detect accidental breaking changes.

## How CI uses these

The `contracts-abi` job in CI runs:

```bash
./scripts/snapshot-abi.sh --check
```

It rebuilds every contract WASM, re-generates the ABI, and diffs it against the
committed snapshot. If anything changed the job fails and the PR is blocked.

## Intentionally updating a snapshot

1. Make your contract change.
2. Regenerate snapshots locally:
   ```bash
   cd contract
   ./scripts/snapshot-abi.sh
   ```
3. Commit the updated `.json` files. **The commit message must include
   `abi-update: <reason>`** so the change is traceable in git history, e.g.:
   ```
   abi-update: add pagination params to content-likes list function
   ```
4. Open a PR — reviewers will see the exact ABI diff in the changed files.

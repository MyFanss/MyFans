# Contract Regression Testing in CI

This document describes how contract regression testing is enforced in the
GitHub Actions CI pipeline (`.github/workflows/ci.yml`).

---

## Jobs

### `contract-test` — full workspace test run

```
cargo test --workspace
```

Runs against **every member** declared in `contract/Cargo.toml`
`[workspace.members]`. The job fails if any crate's tests fail or if a crate
does not compile.

**Why workspace-wide?** A change in `myfans-lib` (shared types) can silently
break `subscription` or `content-access` if only one crate is tested.
`--workspace` ensures all dependency relationships are exercised.

**Timeout budget:** 20 minutes. The Cargo artifact cache (keyed on
`Cargo.lock`) keeps typical runs under 5 minutes on a warm cache.

### `contract-audit` — dependency security scan

```
cargo audit --file audit.toml
```

`audit.toml` sets `severity_threshold = "high"`. Advisories below `high`
(e.g. `warning`-severity unmaintained crate notices) are informational and do
not fail CI.

Known acceptable advisories are listed under `[advisories] ignore` in
`audit.toml` with a justification comment explaining why each is safe for this
project. Any new `high` or `critical` advisory that is not listed there will
fail the job.

---

## Failure handling

| Scenario | Action |
|---|---|
| A workspace crate fails to compile | Fix the compile error before merge |
| A test fails | Fix the test or the code — never delete the test |
| `cargo audit` reports a new high advisory | Either upgrade the dep or add an entry to `audit.toml` with a justification |

---

## Adding a new workspace member

1. Add the crate path to `[workspace.members]` in `contract/Cargo.toml`.
2. Ensure the crate has at least one `#[test]` or `#[cfg(test)]` module.
3. CI will automatically pick it up on the next run — no workflow changes needed.

---

## Badge

Add to `README.md` once the workflow is merged:

```markdown
[![CI](https://github.com/Mimah97/MyFans/actions/workflows/ci.yml/badge.svg)](https://github.com/Mimah97/MyFans/actions/workflows/ci.yml)
```

---

## Related documents

- [REGRESSION_CHECKLIST.md](../REGRESSION_CHECKLIST.md) — developer checklist for PR submission
- [contract/audit.toml](../audit.toml) — audit exception registry with justifications
- [STORAGE_KEYS.md](../STORAGE_KEYS.md) — storage key documentation

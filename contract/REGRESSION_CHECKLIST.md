# Contract Regression Prevention Checklist

Use this checklist when submitting any PR that touches `contract/` source or
dependencies. Tick every item before requesting review. Unticked items block
merge unless you explicitly state why an item does not apply.

---

## 1. Storage key changes

- [ ] No `DataKey` variant was added, removed, or renamed.
  _OR_
  - [ ] `contract/STORAGE_KEYS.md` updated with the new/changed variant.
  - [ ] An entry added to `contract/docs/UPGRADE_NOTES.md` describing the migration path.
  - [ ] Backend indexer mapping reviewed — DB migration added if needed.
  - [ ] No old variant name reused for a different value type.

## 2. Contract interface changes

- [ ] No public `fn` signature changed (arg types, return type, arg order).
  _OR_
  - [ ] `contract/docs/interfaces/` updated for every affected contract.
  - [ ] `AUTH_MATRIX.md` updated if auth requirements changed.
  - [ ] Frontend `stellar.ts` builders reviewed and updated if arg order changed.
  - [ ] Test vectors in `contract/test-vectors/contract-args.json` regenerated.

## 3. Tests

- [ ] `cargo test --workspace` passes locally (all workspace members).
- [ ] New or changed logic covered by at least one unit test in the relevant crate.
- [ ] No existing test was deleted or weakened to make the PR pass.

## 4. Security audit

- [ ] No new `unsafe` blocks introduced without a safety comment.
- [ ] `cargo audit` passes locally (`cargo audit --file contract/audit.toml`).
- [ ] Any new advisory ignored in `audit.toml` has a justification comment.

## 5. ABI / XDR compatibility

- [ ] No change to the XDR encoding of existing contract arguments.
  _OR_
  - [ ] A new contract version / endpoint added alongside the old one.
  - [ ] Deprecation timeline documented.

## 6. CI status checks

All of the following CI jobs must be green before merge (configured in
`.github/workflows/ci.yml`):

- [ ] `contract-test` — `cargo test --workspace` across all members.
- [ ] `contract-audit` — `cargo audit` with `severity_threshold = "high"`.
- [ ] `frontend-lint-test` — ESLint + Vitest pass.

## 7. Documentation

- [ ] `contract/STORAGE_KEYS.md` is consistent with current code (spot-check).
- [ ] `CHANGELOG.md` entry added under the correct section if this is a
  user-visible or integration-visible change.

---

## Quick reference: what CI enforces vs. what the checklist enforces

| Check | CI automated | Checklist |
|---|---|---|
| All workspace members compiled | ✅ | |
| All workspace members tested | ✅ | |
| `cargo audit` (high severity) | ✅ | |
| Storage key doc up-to-date | ❌ (planned) | ✅ |
| Interface doc up-to-date | ❌ (planned) | ✅ |
| Test vectors regenerated | Partial (CI runs TS vectors) | ✅ |
| No unsafe reuse of key names | ❌ | ✅ |

> CI automates the mechanical checks; the checklist covers judgment calls that
> require human review (semantic correctness, documentation completeness,
> migration safety).

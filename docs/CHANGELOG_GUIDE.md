# Changelog Guide

> Issue #1857. Tooling: [`scripts/changelog/generate.mjs`](../scripts/changelog/generate.mjs) · Workflows: [`release-notes.yml`](../.github/workflows/release-notes.yml), [`pr-title.yml`](../.github/workflows/pr-title.yml)

Contributors and operators need to know what changed between releases and whether an upgrade is breaking. We get that from **Conventional Commits** on `main`. Release notes and the root [CHANGELOG.md](../CHANGELOG.md) are generated from them.

---

## 1. Write conventional commits (and PR titles)

PRs are squash-merged, so **the PR title becomes the commit on `main`**. The [`PR title`](../.github/workflows/pr-title.yml) check enforces the format:

```
<type>(<scope>)<!>: <short imperative summary>
```

| Type | Use for | Release-notes section |
|---|---|---|
| `feat` | New user- or API-visible capability | Features |
| `fix` | Bug fix | Bug Fixes |
| `perf` | Performance improvement | Performance |
| `refactor` | Internal change, no behaviour change | Refactoring |
| `revert` | Reverting an earlier change | Reverts |
| `docs` | Documentation only | Documentation |
| `test` | Tests only | Tests |
| `build` | Dependencies, build tooling (Dependabot uses `build(deps)`) | Build & Dependencies |
| `ci` | Workflows | CI |
| `chore` / `style` | Housekeeping, formatting | Hidden unless `--all` |

**Scope** is the package: `contract`, `backend`, or `frontend`. For multi-package PRs, comma-separate them (`feat(backend,frontend): …`). Other scopes (`deps`, `auth`, `docs`) are fine too. When the scope is not a package, the generator works out the package from the files the commit touched.

**Breaking changes.** Add `!` after the type/scope and explain the break in a footer:

```
feat(contract)!: require plan asset allowlist

BREAKING CHANGE: create_plan now reverts with AssetNotAllowed for unlisted assets.
Existing plans are unaffected; clients must call get_allowed_assets first.
```

Breaking entries are listed first, under **⚠ Breaking changes**. A breaking contract change also needs the [Contract Upgrade Governance](CONTRACT_UPGRADE_GOVERNANCE.md) process and an entry in [contract/CHANGELOG.md](../contract/CHANGELOG.md).

Examples:

```
feat(frontend): add Lobstr wallet option to connect modal
fix(backend): reject expired challenge nonces (#1883)
build(deps): bump the backend-minor-patch group across 1 directory with 7 updates
docs: add Postgres backup/restore runbook
```

## 2. Keep secrets out of commit messages

Release notes are **public and permanent**. Never paste keys, seeds, tokens, connection strings, or customer data into commit messages or PR titles. As a safety net, the generator redacts secret-looking strings: Stellar `S…` seeds, JWTs, GitHub tokens, AWS key IDs, `scheme://user:pass@` URLs, and `password=` / `token:`-style pairs. Redaction is not a licence to be careless. If a secret was committed, rotate it ([Secret Management](../backend/docs/SECRET_MANAGEMENT.md)).

## 3. Generate notes locally (dry run)

```bash
# Everything since the last v* tag (or all history if there are no tags yet)
npm run changelog

# A specific range, one package, with a version heading
npm run changelog -- --from v0.1.0 --to HEAD --package contract --version contract-v0.2.0

# Fail if any commit in the range is non-conventional
npm run changelog -- --from v0.1.0 --strict

# Unit tests for the generator
npm run changelog:test
```

All options are listed by `node scripts/changelog/generate.mjs --help`. An example generated from real history is in [release-notes/EXAMPLE.md](release-notes/EXAMPLE.md).

## 4. Release process

| Tag | Scope | Compared against |
|---|---|---|
| `vX.Y.Z` | Whole monorepo | Previous `v*` tag |
| `contract-vX.Y.Z` | Commits touching `contract/` | Previous `contract-v*` tag |
| `backend-vX.Y.Z` | Commits touching `backend/` | Previous `backend-v*` tag |
| `frontend-vX.Y.Z` | Commits touching `frontend/` | Previous `frontend-v*` tag |

1. **Release PR.** On a branch, update the root changelog:
   ```bash
   npm run changelog -- --version v0.2.0 --prepend CHANGELOG.md
   ```
   This inserts the new section under the `<!-- changelog:insert -->` marker. Edit wording if needed: merge duplicate entries, and make sure breaking changes are explained. On the first release, delete the `## Unreleased` placeholder. For contract releases, also update [contract/CHANGELOG.md](../contract/CHANGELOG.md) and bump crate versions. Open a PR titled `chore(release): v0.2.0`.
2. **Tag** the merge commit on `main`: `git tag v0.2.0 && git push origin v0.2.0`.
3. **Automation.** [`release-notes.yml`](../.github/workflows/release-notes.yml) regenerates the notes for the tag and creates or updates the GitHub Release. To preview without publishing, run the workflow manually (**Actions → Release notes → Run workflow**). Manual runs are dry runs and only write to the job summary.

## 5. Mixed history

Before this guide, about a quarter of commits on `main` were not conventional (for example `Add FavoritesModule with…`, `Merge pull request #…`). The tooling handles them like this:

- **Merge commits** are skipped (`--no-merges`). Squash commits carry the `(#NNN)` PR link.
- **Non-conventional commits** are not dropped. They go under **Other changes**, still tagged with their package.
- **`--strict`** fails on any non-conventional commit. Use it for ranges that start after the PR-title check was enabled.
- **Old history is not rewritten or backfilled.** The root changelog starts at the first `v*` tag.

## 6. PR template reminder

The [PR template](../.github/PULL_REQUEST_TEMPLATE.md) includes a **Changelog** checklist:

- Conventional title
- `!` + `BREAKING CHANGE:` footer for breaking changes
- Contract changelog for `contract/` changes
- No secrets in the title or description

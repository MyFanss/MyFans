# CI Cache Configuration

## Overview

This document describes the caching strategy implemented in the CI/CD pipelines to speed up build times by caching dependencies.

## Caching Strategy

### Node.js (npm) Caching

**Workflows affected:**
- `.github/workflows/ci.yml` (backend, frontend, db-backup-drill jobs)
- `.github/workflows/backend-ci.yml` (backend job)
- `.github/workflows/frontend-ci.yml` (frontend job)

**Cache scope:**
- Caches `node_modules` and npm registry cache
- Uses `setup-node@v4` with built-in npm caching support
- Cache key is based on `package-lock.json` hash

**Configuration:**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: npm
    cache-dependency-path: backend/package-lock.json
```

**Behavior:**
- ✅ Cache is restored before `npm ci` (install step)
- ✅ Cache is automatically saved after successful job completion
- ✅ Separate cache per package-lock.json file (backend vs frontend)
- ✅ Cache invalidates when package-lock.json changes

### Rust/Cargo Caching

**Workflows affected:**
- `.github/workflows/ci.yml` (contract, wasm-size jobs)
- `.github/workflows/contract-ci.yml` (contract job)
- `.github/workflows/contract-msrv.yml` (msrv job)
- `.github/workflows/wasm-size.yml` (wasm-size job)
- `.github/workflows/abi-snapshot.yml` (abi snapshot job)

**Cache scope:**
- Caches `~/.cargo/registry` (downloaded dependencies)
- Caches `contract/target` (compiled artifacts)
- Caches `~/.cargo/git` (git dependencies)

**Configuration (preferred):**

Using `Swatinem/rust-cache@v2` (modern, maintained):
```yaml
- name: Cache Cargo registry and target
  uses: Swatinem/rust-cache@v2
  with:
    workspaces: contract
```

Alternative (manual caching):
```yaml
- name: Cache Cargo registry
  uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry/index
      ~/.cargo/registry/cache
      ~/.cargo/git/db
      ~/.cargo/git/checkouts
    key: ${{ runner.os }}-cargo-registry-${{ hashFiles('contract/Cargo.lock') }}

- name: Cache Cargo target directory
  uses: actions/cache@v4
  with:
    path: contract/target
    key: ${{ runner.os }}-contract-target-${{ hashFiles('contract/Cargo.lock') }}
```

**Behavior:**
- ✅ Cache is restored before Rust toolchain setup
- ✅ Cache is automatically saved after successful job completion
- ✅ Separate cache for MSRV builds using Rust version in key
- ✅ Cache invalidates when Cargo.lock changes

## Cache Flow Diagram

```
                    CI Workflow Start
                           |
                           v
              +-------- Job Starts --------+
              |                            |
         Node.js job                   Rust job
              |                            |
              v                            v
    1. Checkout code           1. Checkout code
    2. Setup Node.js           2. Setup Rust
    3. Restore npm cache       3. Restore Cargo cache
    4. npm ci (install)        4. cargo build
    5. npm run lint            5. cargo clippy
    6. npm test                6. cargo test
    7. npm run build           7. cargo build --release
    8. [Save npm cache]        8. [Save Cargo cache]
              |                            |
              +--------- Success ---------+
```

## Cache Invalidation

Caches are invalidated and regenerated when:

- **npm cache:** `package-lock.json` changes
- **Cargo registry:** `contract/Cargo.lock` changes
- **Cargo target:** `contract/Cargo.lock` changes OR 30 days of inactivity

## Performance Impact

Expected improvements:
- **Backend CI:** 2-3 min faster (skip npm install on cache hit)
- **Frontend CI:** 2-3 min faster (skip npm install on cache hit)
- **Contract CI:** 3-5 min faster (skip Cargo dependency download and compilation)

Total time savings per PR: **7-11 minutes**

## Verification

To verify caching is properly configured:

```bash
# Check for required dependency files
scripts/validate-cache-config.sh

# Run cache configuration tests
npm test -- ci-cache-config.test.ts
```

## Troubleshooting

### Cache not being restored

**Possible causes:**
- Cache key doesn't match (dependency file was modified)
- Cache storage exceeded GitHub's 10GB per repository limit
- Different runner OS (cache is OS-specific)

**Solution:**
- Check GitHub Actions run logs for cache hit/miss information
- Verify `package-lock.json` or `Cargo.lock` hasn't unexpectedly changed
- Clear cache if needed: GitHub Settings → Actions → Clear all caches

### Stale cache

**Possible causes:**
- Dependency lock files are out of sync with actual dependencies
- Manual cache corruption

**Solution:**
- Update dependencies: `npm install` or `cargo update`
- Commit updated lock files
- Cache will be regenerated on next run

## Best Practices

1. **Keep lock files committed:** Always commit `package-lock.json` and `Cargo.lock`
2. **Review lock file changes:** Check for unexpected updates in lock files
3. **Monitor cache hit rate:** Watch GitHub Actions logs for cache hit/miss ratios
4. **Regenerate cache periodically:** Let cache expire naturally (30 days) for safety
5. **Document cache keys:** Maintain this documentation when adding new workflows

## Related Workflows

- [ci.yml](.github/workflows/ci.yml) - Main CI pipeline
- [backend-ci.yml](.github/workflows/backend-ci.yml) - Backend-specific CI
- [frontend-ci.yml](.github/workflows/frontend-ci.yml) - Frontend-specific CI
- [contract-ci.yml](.github/workflows/contract-ci.yml) - Contract-specific CI
- [contract-msrv.yml](.github/workflows/contract-msrv.yml) - MSRV verification

## References

- [GitHub Actions: caching dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-and-build-outputs)
- [setup-node caching documentation](https://github.com/actions/setup-node#caching-packages-dependencies)
- [Swatinem/rust-cache](https://github.com/Swatinem/rust-cache)

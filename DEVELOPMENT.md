# Local Development Guide

One-command local stack using Docker Compose with the `dev` profile.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)
- Git
- **For contract development**: Rust stable with wasm32 target
  ```bash
  rustup install stable
  rustup target add wasm32-unknown-unknown
  ```

## Quick Start

### 1. Set up environment variables

```bash
cp .env.dev.example .env.dev
```

Open `.env.dev` and fill in any values marked as required. The defaults work
out of the box for local development — at minimum set a real `JWT_SECRET`:

```bash
# Generate a strong secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Start the dev stack

```bash
docker compose -f docker-compose.dev.yml --profile dev up
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Backend (NestJS)** on `localhost:3001` with hot reload

Add `--build` to force a rebuild of the backend image (e.g. after changing
`Dockerfile.dev` or `package.json`):

```bash
docker compose -f docker-compose.dev.yml --profile dev up --build
```

### 3. Verify the stack is running

```bash
curl http://localhost:3001/v1/health
# Expected: {"status":"ok","timestamp":"..."}
```

Or open `http://localhost:3001/v1/health` in your browser.

---

## Contract Development

Contracts are in the `contract/` directory and use Soroban SDK.

### Running Tests

Test contract code before committing:

```bash
cd contract

# Run all tests
cargo test --all-features

# Run tests for a specific contract
cd contract/contracts/myfans-token && cargo test

# Run with output for debugging
cargo test -- --nocapture

# Watch mode (requires cargo-watch: cargo install cargo-watch)
cargo watch -x test
```

### Pre-commit Verification

Before pushing contract changes, run all CI checks locally:

```bash
cd contract && \
  cargo fmt --all --check && \
  cargo clippy --all-targets --all-features -- -D warnings && \
  cargo test --all-features && \
  cargo build --release --target wasm32-unknown-unknown
```

### Building WASM Artifacts

To build optimized WASM files for deployment:

```bash
cd contract
cargo build --release --target wasm32-unknown-unknown
```

Artifacts appear in: `contract/target/wasm32-unknown-unknown/release/`

### Contract Testing Guide

For comprehensive testing patterns, see [contract/TESTING.md](./contract/TESTING.md)

Key points:
- All tests use the Soroban test environment (no network access required)
- Tests cover happy path, error conditions, and edge cases
- Authorization and cross-contract interactions are tested
- Every PR requires passing contract tests in CI

### Regression Prevention

Use the [Regression Prevention Checklist](./contract/REGRESSION_CHECKLIST.md) when:
- Adding new contracts
- Modifying contract interfaces
- Adding new contract methods
- Changing authorization rules

---

## Hot Reload

The backend source (`./backend/src`) is bind-mounted into the container.
`nest start --watch` watches for `.ts` file changes and recompiles automatically.

To see the watcher output:

```bash
docker compose -f docker-compose.dev.yml --profile dev logs -f backend
```

Edit any file under `backend/src/`, save it, and watch the logs — the NestJS
process will restart within a few seconds and your change will be live.

---

## Resetting the Database

To wipe the dev database and start fresh (removes the `postgres_dev_data` volume):

```bash
docker compose -f docker-compose.dev.yml --profile dev down -v
docker compose -f docker-compose.dev.yml --profile dev up
```

> **Note:** This only removes the dev volume (`myfans_postgres_dev_data`).
> Production data is unaffected.

---

## Stopping the Stack

```bash
# Stop containers (keep volumes)
docker compose -f docker-compose.dev.yml --profile dev down

# Stop containers and remove volumes (full reset)
docker compose -f docker-compose.dev.yml --profile dev down -v
```

---

## Troubleshooting

**Port 5432 already in use**
Another Postgres instance is running locally. Stop it or change the host port
in `docker-compose.dev.yml`.

**Backend container is `unhealthy`**
Check the logs:
```bash
docker compose -f docker-compose.dev.yml --profile dev logs backend
```
Common causes: missing `JWT_SECRET` in `.env.dev`, TypeORM migration failure,
or Postgres not yet ready.

**Changes not reflected after editing a file**
Confirm the watcher is running in the logs. If the container exited, restart it:
```bash
docker compose -f docker-compose.dev.yml --profile dev restart backend
```

**Stale image after changing `Dockerfile.dev` or `package.json`**
Force a rebuild:
```bash
docker compose -f docker-compose.dev.yml --profile dev up --build
```

**Contract tests failing locally but passing in CI**
Ensure you're using the same workspace manifest:
```bash
cd contract && cargo test --all-features --manifest-path Cargo.toml
```

**Rust toolchain not found**
Install Rust and add the wasm32 target:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```


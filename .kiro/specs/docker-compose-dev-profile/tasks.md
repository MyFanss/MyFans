# Implementation Plan: Docker Compose Dev Profile

## Overview

Implement the dev profile by creating the Dockerfile.dev, docker-compose.dev.yml override, environment template, gitignore update, health unit test, property-based config test, CI smoke workflow, and DEVELOPMENT.md checklist. No production files are modified.

## Tasks

- [x] 1. Create `backend/Dockerfile.dev`
  - Write a dev-only Dockerfile based on `node:20-alpine`
  - Run `npm ci --include=dev` (installs devDependencies)
  - Do NOT include `COPY . .` or `npm run build`
  - Set `CMD ["npm", "run", "start:dev"]` and `EXPOSE 3001`
  - _Requirements: 2.2, 3.1_

- [x] 2. Create `docker-compose.dev.yml` override file
  - [x] 2.1 Define postgres service with dev profile and health check
    - Add `profiles: [dev]` to postgres service
    - Health check: `pg_isready -U postgres`, interval 10s, timeout 5s, retries 5
    - Use named volume `postgres_dev_data` (separate from production)
    - _Requirements: 1.1, 4.1, 6.4_

  - [x] 2.2 Define backend service with dev profile, hot reload, and health check
    - Add `profiles: [dev]` to backend service
    - Set `dockerfile: Dockerfile.dev`, `NODE_ENV=development`
    - Volumes: bind-mount `./backend:/app`, anonymous volume `/app/node_modules`
    - Command: `npm run start:dev`
    - Health check: `curl -f http://localhost:3001/v1/health || exit 1`, interval 15s, timeout 5s, start_period 30s, retries 3
    - `depends_on: postgres: condition: service_healthy`
    - `env_file: .env.dev` at top level
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.4, 3.1, 3.2, 4.2, 4.3_

- [x] 3. Create `.env.dev.example` at repo root
  - Include all required variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PORT, NODE_ENV, STELLAR_NETWORK, SOROBAN_RPC_URL, STARTUP_MODE
  - Set `PORT=3001`, `NODE_ENV=development`, `STARTUP_MODE=degraded`, `STELLAR_NETWORK=testnet` as safe defaults
  - Add inline comments explaining each variable
  - _Requirements: 5.1, 5.4_

- [x] 4. Update `.gitignore` to explicitly include `.env.dev`
  - Add `.env.dev` as an explicit entry under the Environment section
  - Keep existing `.env.*` wildcard and `!.env.example` exception intact
  - _Requirements: 5.2_

- [x] 5. Add health endpoint unit test to `backend/src/health/health.controller.spec.ts`
  - [x] 5.1 Add test asserting `GET /v1/health` returns HTTP 200 with correct body shape
    - Assert `result.status === 'ok'`
    - Assert `result.timestamp` is a valid ISO 8601 string (matches `/^\d{4}-\d{2}-\d{2}T/`)
    - _Requirements: 4.2, 7.3_

  - [ ]* 5.2 Write property test for health response timestamp validity
    - **Property 1 (partial): Health response timestamp is always a valid ISO 8601 string**
    - **Validates: Requirements 7.3**

- [x] 6. Create `backend/src/health/config.properties.spec.ts` — startup validation property test
  - [x] 6.1 Implement property test for startup validation rejecting incomplete required variable sets
    - Import `fc` from `fast-check` and `validateRequiredSecrets` from `../../common/secrets-validation`
    - Required keys: `['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET']`
    - Use `fc.subarray` to generate all non-empty, incomplete subsets (present keys)
    - For each subset: set only those keys in a mock env, assert `validateRequiredSecrets` throws and error message includes each missing key name
    - Run with `{ numRuns: 100 }`
    - **Property 1: Startup validation rejects missing required variables**
    - **Validates: Requirements 5.3**
    - _Requirements: 5.3_

- [x] 7. Checkpoint — ensure all backend tests pass
  - Run `npm test` in `backend/` and confirm no regressions. Ask the user if questions arise.

- [x] 8. Create `.github/workflows/docker-compose-smoke.yml` CI smoke test
  - Trigger on push/PR to `main` and `develop`
  - Steps: checkout → copy `.env.dev.example` to `.env.dev` → `docker compose --profile dev up -d --build` → poll `http://localhost:3001/v1/health` with 60s timeout → print backend logs on failure → `docker compose --profile dev down -v` in `always` cleanup step
  - Set `timeout-minutes: 10`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. Create `DEVELOPMENT.md` manual verification checklist
  - Document: copy `.env.dev.example` → `.env.dev`, fill required values, run `docker compose --profile dev up`, verify `curl http://localhost:3001/v1/health` returns `{"status":"ok"}`
  - Document database reset: `docker compose --profile dev down -v` then `docker compose --profile dev up`
  - Document hot-reload workflow: edit a `.ts` file under `backend/src`, observe NestJS watcher output in `docker compose --profile dev logs -f backend`, confirm change is live
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Final checkpoint — verify end-to-end wiring
  - Confirm `docker-compose.dev.yml` references `Dockerfile.dev` correctly
  - Confirm `.env.dev.example` covers every variable referenced in `docker-compose.dev.yml`
  - Confirm `.gitignore` contains `.env.dev`
  - Ensure all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Production `docker-compose.yml` and `backend/Dockerfile` are never modified
- `validateRequiredSecrets` in `secrets-validation.ts` already validates the six required keys — the property test exercises it directly
- The health endpoint is already implemented at `GET /v1/health`; task 5 only adds the explicit 200 + body-shape assertion
- CI smoke test copies `.env.dev.example` verbatim so no real secrets are needed in CI

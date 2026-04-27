# Requirements Document

## Introduction

This feature adds a Docker Compose dev profile to the MyFans repository, enabling a true one-command local development experience. The dev profile separates development-specific configuration from production, provides hot reload for the NestJS backend, proper health checks, and a `.env.dev` file for local secrets — all without touching the existing production-oriented `docker-compose.yml` setup.

## Glossary

- **Dev_Stack**: The set of Docker Compose services started when the `dev` profile is active (`docker compose --profile dev up`).
- **Backend_Service**: The NestJS application container running in development mode with `npm run start:dev`.
- **Postgres_Service**: The PostgreSQL 15 container providing the local development database.
- **Health_Check**: A Docker-native probe that reports a container's readiness before dependents start.
- **Hot_Reload**: Automatic restart of the NestJS process when source files change, enabled by `nest start --watch` and a bind-mounted source tree.
- **Env_File**: A `.env.dev` file at the repository root that supplies all required environment variables to the Dev_Stack; it is never committed to version control.
- **Stale_State**: A condition where a container is running with an outdated image, missing volume, or mismatched environment that no longer reflects the current source.
- **CI_Smoke_Test**: A GitHub Actions job that starts the Dev_Stack, waits for health checks to pass, and verifies the backend `/health` endpoint responds with HTTP 200.

## Requirements

### Requirement 1: One-Command Dev Stack Startup

**User Story:** As a backend developer, I want to start the entire local stack with a single command, so that I can begin developing immediately without manual setup steps.

#### Acceptance Criteria

1. WHEN a developer runs `docker compose --profile dev up`, THE Dev_Stack SHALL start Postgres_Service and Backend_Service in dependency order.
2. THE Dev_Stack SHALL read all environment variables from a `.env.dev` file at the repository root when that file is present.
3. WHEN the `.env.dev` file is absent, THE Dev_Stack SHALL fail with a descriptive error message rather than starting with missing required variables.
4. THE Dev_Stack SHALL expose the backend on host port `3001` and Postgres on host port `5432`.

---

### Requirement 2: Dev Profile Isolation

**User Story:** As a developer, I want dev-specific configuration kept separate from the production compose file, so that local changes do not risk breaking production deployments.

#### Acceptance Criteria

1. THE Dev_Stack SHALL be defined in a dedicated `docker-compose.dev.yml` override file, not by modifying `docker-compose.yml`.
2. WHEN the `dev` profile is active, THE Backend_Service SHALL use a `Dockerfile.dev` that installs all dependencies (including devDependencies) and does not run `npm run build`.
3. WHEN the `dev` profile is not active, THE Backend_Service SHALL continue to use the existing production `Dockerfile` unchanged.
4. THE `docker-compose.dev.yml` file SHALL set `NODE_ENV=development` for Backend_Service.

---

### Requirement 3: Hot Reload

**User Story:** As a backend developer, I want source file changes to be reflected in the running container automatically, so that I do not need to rebuild or restart the container manually.

#### Acceptance Criteria

1. THE Backend_Service SHALL bind-mount `./backend` into `/app` inside the container.
2. THE Backend_Service SHALL exclude `/app/node_modules` from the bind mount via an anonymous volume.
3. WHEN a `.ts` source file under `./backend/src` is saved, THE Backend_Service SHALL restart the NestJS process within 5 seconds via `nest start --watch`.

---

### Requirement 4: Health Checks

**User Story:** As a developer, I want containers to report their own readiness, so that dependent services only start after their dependencies are healthy.

#### Acceptance Criteria

1. THE Postgres_Service SHALL declare a Health_Check using `pg_isready -U <DB_USER>` with an interval of 10 s, timeout of 5 s, and 5 retries.
2. THE Backend_Service SHALL declare a Health_Check that issues an HTTP GET to `http://localhost:3001/health` with an interval of 15 s, timeout of 5 s, start period of 30 s, and 3 retries.
3. WHEN Postgres_Service Health_Check has not yet passed, THE Backend_Service SHALL not start.
4. IF the Backend_Service Health_Check fails all retries, THE Dev_Stack SHALL mark the container as `unhealthy` and surface the failure in `docker compose ps` output.

---

### Requirement 5: Environment Variable Handling

**User Story:** As a developer, I want a documented, safe way to supply local secrets, so that I never accidentally commit credentials to version control.

#### Acceptance Criteria

1. THE repository SHALL include a `.env.dev.example` file at the root containing all variables required by the Dev_Stack with placeholder values and inline comments.
2. THE `.gitignore` SHALL list `.env.dev` so that the file is never tracked by Git.
3. WHEN a required variable (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET) is absent from the environment, THE Backend_Service SHALL exit with a non-zero code and log the name of the missing variable.
4. THE `.env.dev.example` SHALL set `STARTUP_MODE=degraded`, `STELLAR_NETWORK=testnet`, and `NODE_ENV=development` as safe defaults for local development.

---

### Requirement 6: Stale and Invalid State Handling

**User Story:** As a developer, I want the dev stack to detect and recover from stale or invalid states, so that I do not waste time debugging environment drift.

#### Acceptance Criteria

1. WHEN `docker compose --profile dev up --build` is run, THE Dev_Stack SHALL rebuild Backend_Service from the current `Dockerfile.dev` before starting.
2. WHEN the Postgres data volume exists but contains a schema incompatible with the current migrations, THE Backend_Service SHALL log a migration error and exit with a non-zero code rather than silently operating on a corrupt schema.
3. IF the Postgres_Service container is removed while Backend_Service is running, THEN THE Backend_Service SHALL log a database connection error and exit with a non-zero code within 30 seconds.
4. THE `docker-compose.dev.yml` SHALL define a named volume `postgres_dev_data` separate from any production volume, so that `docker compose down -v` in dev does not affect production data.

---

### Requirement 7: CI Smoke Test

**User Story:** As a maintainer, I want CI to verify the dev stack starts correctly, so that broken compose configuration is caught before it reaches developers.

#### Acceptance Criteria

1. THE CI_Smoke_Test SHALL be defined as a GitHub Actions job in `.github/workflows/ci.yml` or a dedicated workflow file.
2. WHEN the CI_Smoke_Test job runs, THE CI_Smoke_Test SHALL start the Dev_Stack using `docker compose --profile dev up -d --build`.
3. WHEN the Dev_Stack is running, THE CI_Smoke_Test SHALL poll `http://localhost:3001/health` until it returns HTTP 200 or a 60-second timeout elapses.
4. IF the health endpoint does not return HTTP 200 within 60 seconds, THEN THE CI_Smoke_Test SHALL fail the job and print the Backend_Service container logs.
5. WHEN the CI_Smoke_Test job completes (pass or fail), THE CI_Smoke_Test SHALL run `docker compose --profile dev down -v` to clean up all containers and volumes.

---

### Requirement 8: Manual Verification Checklist

**User Story:** As a developer or reviewer, I want a short manual checklist, so that I can confirm the dev stack works correctly on a fresh machine without running CI.

#### Acceptance Criteria

1. THE repository SHALL include a `DEVELOPMENT.md` (or equivalent section in an existing doc) listing the steps: copy `.env.dev.example` to `.env.dev`, fill in required values, run `docker compose --profile dev up`, and verify `curl http://localhost:3001/health` returns `{"status":"ok"}`.
2. THE checklist SHALL document how to reset the dev database: `docker compose --profile dev down -v` followed by `docker compose --profile dev up`.
3. THE checklist SHALL document the hot-reload workflow: edit a `.ts` file, observe the NestJS watcher output in container logs, and confirm the change is live.

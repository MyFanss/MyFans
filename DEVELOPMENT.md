# Local Development Guide

One-command local stack using Docker Compose with the `dev` profile.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)
- Git

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

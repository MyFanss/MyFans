# Chain Event Replay CLI

## Purpose

Replay historical Stellar chain events into PostgreSQL to recover indexer gaps safely.

## Command

```bash
npm run replay:chain-events -- --start-cursor <cursor> [--end-cursor <cursor>] [--dry-run] [--limit 200]
```

## Required Environment

- `DATABASE_URL`: PostgreSQL connection string
- `HORIZON_URL` (optional): Horizon base URL (defaults to `https://horizon-testnet.stellar.org`)

## Parameters

- `--start-cursor` (required): Inclusive starting cursor for replay.
- `--end-cursor` (optional): Inclusive ending cursor; replay stops once this cursor is reached.
- `--dry-run` (optional): Reads and evaluates events but does not write to DB.
- `--limit` (optional): Page size per request (1..200, default `200`).

## Idempotency and Safety

- Replayed records are stored in table `chain_event_replay`.
- Each record is keyed by `paging_token` and deduplicated with `ON CONFLICT DO NOTHING`.
- Re-running the same range is safe; duplicates are skipped and reported in summary output.

## Dry-Run Workflow (Recommended)

1. Validate scope and expected volume:

```bash
npm run replay:chain-events -- --start-cursor 123 --end-cursor 999 --dry-run
```

2. Execute replay:

```bash
npm run replay:chain-events -- --start-cursor 123 --end-cursor 999
```

## Output

The CLI prints JSON summary:

- `startCursor`
- `endCursor`
- `finalCursor`
- `pages`
- `fetched`
- `inserted`
- `duplicates`
- `dryRun`

Use `finalCursor` as a checkpoint for subsequent replay windows.

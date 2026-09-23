# Creator Registry Contract Interface

Status: Draft
Workspace: `creator-registry`
Related: `backend/docs/CREATOR_REGISTRY_SYNC.md`, `backend/test/creators.e2e-spec.ts`

## Purpose

The creator registry provides canonical creator identity on-chain. It stores only
non-PII references (metadata hash or CID) and emits versioned events that the
backend can idempotently sync into its database so public profile APIs serve
fields that match chain state.

## Storage

```
Creator {
  pubkey: Address,          // creator identity / auth subject
  metadata_hash_or_uri: String, // hash or CID only; never raw PII
  suspended: bool,          // moderation bridge flag (admin-gated)
  updated_at_ledger: u64,
}
```

Keyed by `pubkey`. No raw PII is stored on-chain; only a hash or CID reference.

## Methods

### `register(creator, metadata_hash_or_uri)`

- Requires creator auth: caller must be `creator`.
- Creates the creator record if absent.
- If the creator already exists, behaves as an update (see below) rather than
  reverting, so double-register is idempotent at the contract level.
- Rejects malformed metadata: if `metadata_hash_or_uri` is not a valid hash or
  CID, the call reverts. Hash-only storage is used when a URI is not supplied.
- Emits `CreatorRegistered`.

### `update(creator, metadata_hash_or_uri)`

- Requires creator auth: caller must be `creator`.
- Reverts if the creator does not exist.
- Reverts if the caller is not the owner (update by non-owner → revert).
- Rejects malformed metadata as in `register`.
- Emits `CreatorUpdated`.

### `force_suspend(creator, suspended)` (optional, admin)

- Moderation bridge. Requires off-chain RBAC to authorize the admin caller;
  the on-chain flag is optional and mirrors the off-chain decision.
- Sets `suspended` on the creator record.
- Emits `CreatorSuspended`.

## Events

All events carry a `schema_version` field for forward compatibility.

```
CreatorRegistered {
  schema_version: u32,
  pubkey: Address,
  metadata_hash_or_uri: String,
  ledger_seq: u64,
  event_index: u32,
}

CreatorUpdated {
  schema_version: u32,
  pubkey: Address,
  metadata_hash_or_uri: String,
  ledger_seq: u64,
  event_index: u32,
}

CreatorSuspended {
  schema_version: u32,
  pubkey: Address,
  suspended: bool,
  ledger_seq: u64,
  event_index: u32,
}
```

### Event identity

Each event is uniquely identified by `ledgerSeq:eventIndex`. Backend sync uses
this composite key for idempotency: duplicate delivery of the same event yields a
single row.

## Backend sync contract

- Upsert creators by `pubkey`.
- Idempotent on `ledgerSeq:eventIndex`; re-delivery is a no-op.
- `CreatorRegistered` and `CreatorUpdated` both upsert the profile fields.
- `CreatorSuspended` updates the moderation flag.
- Public profile API serves the synced fields (pubkey, metadata reference,
  suspended, updated_at_ledger).

## Edge cases & failure modes

- Double register → treated as update (documented above).
- Update by non-owner → revert.
- Backend duplicate event delivery → single row (idempotent on
  `ledgerSeq:eventIndex`).
- Malformed metadata URI → reject, or store as hash-only when a hash is provided.

## Security considerations

- Do not store raw PII on-chain; hash or CID only.
- Admin suspend requires off-chain RBAC plus the optional on-chain flag.

## Out of scope

- ENS-style human-readable names.

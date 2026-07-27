/**
 * Stub consumer for unlock events -> entitlement cache updates.
 *
 * Not wired into events.module.ts yet. Standalone stub so the shape of
 * the consumer + upsert semantics can be reviewed before wiring it to
 * the real event bus / mock RPC (see subscriptions/__mocks__/soroban-rpc.mock.ts
 * and docs/entitlement-subscribe-e2e-plan.md).
 */

export interface UnlockEvent {
  fanId: string;
  creatorId: string;
  contentId: string;
  unlockedAt: number;
}

export interface AccessRow {
  fanId: string;
  creatorId: string;
  contentId: string;
  unlockedAt: number;
}

/**
 * In-memory stand-in for the entitlement cache's access table.
 * Upsert is keyed on (fanId, creatorId, contentId) so replaying the
 * same unlock event is a no-op beyond refreshing unlockedAt.
 */
export class UnlockEventConsumerStub {
  private readonly accessRows = new Map<string, AccessRow>();

  private key(event: Pick<UnlockEvent, 'fanId' | 'creatorId' | 'contentId'>): string {
    return `${event.fanId}:${event.creatorId}:${event.contentId}`;
  }

  /** Mock "listen" entrypoint — call directly with a decoded unlock event. */
  handle(event: UnlockEvent): AccessRow {
    return this.upsertAccessRow(event);
  }

  upsertAccessRow(event: UnlockEvent): AccessRow {
    const key = this.key(event);
    const existing = this.accessRows.get(key);

    const row: AccessRow = {
      fanId: event.fanId,
      creatorId: event.creatorId,
      contentId: event.contentId,
      unlockedAt: existing
        ? Math.min(existing.unlockedAt, event.unlockedAt)
        : event.unlockedAt,
    };

    this.accessRows.set(key, row);
    return row;
  }

  hasAccess(fanId: string, creatorId: string, contentId: string): boolean {
    return this.accessRows.has(this.key({ fanId, creatorId, contentId }));
  }
}

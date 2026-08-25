import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AdminAuditEvent } from './entities/admin-audit-event.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { PaginatedResponseDto } from '../common/dto';

export interface RecordAuditEventInput {
  /** User ID of the admin/actor performing the action. */
  actorId: string;
  /** Machine-readable action name, e.g. "user.role_changed". */
  action: string;
  /** ID of the entity acted on (user id, moderation flag id, etc). */
  target: string;
  /** Contextual payload — hashed, never stored verbatim. */
  payload: Record<string, unknown>;
  /** Correlation ID of the triggering request, if available. */
  correlationId?: string | null;
}

/**
 * Append-only audit log for admin-privileged actions (#1568): role changes
 * and moderation decisions. There is intentionally no update/delete method
 * here — once written, a row is immutable.
 */
@Injectable()
export class AdminAuditService {
  constructor(
    @InjectRepository(AdminAuditEvent)
    private readonly auditRepo: Repository<AdminAuditEvent>,
  ) {}

  async record(input: RecordAuditEventInput): Promise<AdminAuditEvent> {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(input.payload ?? {}))
      .digest('hex');

    const event = this.auditRepo.create({
      actor_id: input.actorId,
      action: input.action,
      target: input.target,
      payload_hash: payloadHash,
      correlation_id: input.correlationId ?? null,
    });

    return this.auditRepo.save(event);
  }

  async findPaginated(
    query: QueryAuditLogDto,
  ): Promise<PaginatedResponseDto<AdminAuditEvent>> {
    const { cursor, limit = 20, actor_id, target, action } = query;

    const qb = this.auditRepo
      .createQueryBuilder('event')
      .orderBy('event.created_at', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(limit + 1);

    if (cursor) {
      // Cursor is the previous page's last row's created_at (ISO string) —
      // pairs with the ORDER BY above, unlike the row's (random) uuid id.
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        qb.andWhere('event.created_at < :cursor', { cursor: cursorDate });
      }
    }
    if (actor_id) qb.andWhere('event.actor_id = :actor_id', { actor_id });
    if (target) qb.andWhere('event.target = :target', { target });
    if (action) qb.andWhere('event.action = :action', { action });

    const data = await qb.getMany();
    const hasMore = data.length > limit;
    if (hasMore) data.pop();

    const nextCursor =
      data.length > 0 ? data[data.length - 1].created_at.toISOString() : null;

    return new PaginatedResponseDto(data, limit, nextCursor, hasMore);
  }
}

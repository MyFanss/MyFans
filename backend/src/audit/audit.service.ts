import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { RequestContextService } from '../common/services/request-context.service';
import { AuditableActionName, AuditActorType } from './auditable-action';
import { sanitizeAuditMetadata } from './audit-metadata.sanitizer';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditLog } from './entities/audit-log.entity';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

export interface AuditRecordInput {
  action: AuditableActionName;
  actorType: AuditActorType;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Persists an audit row. Never throws to callers — failures are logged only.
   */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      const metadata = sanitizeAuditMetadata(input.metadata ?? undefined);
      const correlationId = this.requestContext.getCorrelationId();
      const row = this.repo.create({
        action: input.action,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        metadata,
        correlationId,
        ip: input.ip ?? null,
      });
      await this.repo.save(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Audit record failed (${input.action}): ${message}`);
    }
  }

  async query(dto: AuditQueryDto): Promise<PaginatedResponseDto<AuditLog>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const where: FindOptionsWhere<AuditLog> = {};

    if (dto.action) {
      where.action = dto.action;
    }
    if (dto.actorId) {
      where.actorId = dto.actorId;
    }

    const fromDate = dto.from ? new Date(dto.from) : undefined;
    const toDate = dto.to ? new Date(dto.to) : undefined;

    if (fromDate && toDate) {
      where.createdAt = Between(fromDate, toDate);
    } else if (fromDate) {
      where.createdAt = MoreThanOrEqual(fromDate);
    } else if (toDate) {
      where.createdAt = LessThanOrEqual(toDate);
    }

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(rows, total, page, limit);
  }
}

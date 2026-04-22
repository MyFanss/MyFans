import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationFlag, ModerationStatus } from './entities/moderation-flag.entity';
import { ModerationAuditLog } from './entities/moderation-audit-log.entity';
import { CreateFlagDto } from './dto/create-flag.dto';
import { ReviewFlagDto } from './dto/review-flag.dto';
import { QueryFlagsDto } from './dto/query-flags.dto';
import { PaginatedResponseDto } from '../common/dto';

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ModerationFlag)
    private readonly flagRepo: Repository<ModerationFlag>,
    @InjectRepository(ModerationAuditLog)
    private readonly auditRepo: Repository<ModerationAuditLog>,
  ) {}

  async createFlag(reportedBy: string, dto: CreateFlagDto): Promise<ModerationFlag> {
    const existing = await this.flagRepo.findOne({
      where: {
        content_type: dto.content_type,
        content_id: dto.content_id,
        reported_by: reportedBy,
        status: ModerationStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException('You have already flagged this content');
    }

    const flag = this.flagRepo.create({
      ...dto,
      reported_by: reportedBy,
      notes: dto.notes ?? null,
    });

    return this.flagRepo.save(flag);
  }

  async findAll(query: QueryFlagsDto): Promise<PaginatedResponseDto<ModerationFlag>> {
    const { cursor, limit = 20, status, content_type, content_id } = query;

    const qb = this.flagRepo
      .createQueryBuilder('flag')
      .orderBy('flag.id', 'ASC')
      .take(limit + 1);

    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        qb.andWhere('flag.id > :cursorId', { cursorId });
      }
    }

    if (status) qb.andWhere('flag.status = :status', { status });
    if (content_type) qb.andWhere('flag.content_type = :content_type', { content_type });
    if (content_id) qb.andWhere('flag.content_id = :content_id', { content_id });

    const data = await qb.getMany();
    const hasMore = data.length > limit;
    if (hasMore) {
      data.pop();
    }

    let nextCursor: string | null = null;
    if (data.length > 0) {
      nextCursor = String(data[data.length - 1].id);
    }

    return new PaginatedResponseDto(data, limit, nextCursor, hasMore);
  }

  async findOne(id: string): Promise<ModerationFlag> {
    const flag = await this.flagRepo.findOne({ where: { id } });
    if (!flag) throw new NotFoundException(`Moderation flag ${id} not found`);
    return flag;
  }

  async reviewFlag(
    adminId: string,
    flagId: string,
    dto: ReviewFlagDto,
  ): Promise<ModerationFlag> {
    const flag = await this.findOne(flagId);
    const previousStatus = flag.status;

    flag.status = dto.status;
    flag.reviewed_by = adminId;
    flag.reviewed_at = new Date();
    flag.admin_notes = dto.admin_notes ?? null;

    const updated = await this.flagRepo.save(flag);

    // Persist audit trail
    await this.auditRepo.save(
      this.auditRepo.create({
        flag_id: flagId,
        admin_id: adminId,
        previous_status: previousStatus,
        new_status: dto.status,
        notes: dto.admin_notes ?? null,
      }),
    );

    return updated;
  }

  async getAuditLog(flagId: string): Promise<ModerationAuditLog[]> {
    await this.findOne(flagId); // ensure flag exists
    return this.auditRepo.find({
      where: { flag_id: flagId },
      order: { created_at: 'ASC' },
    });
  }
}

import { Inject, Injectable, LoggerService } from '@nestjs/common';

export interface AdminAuditRecordInput {
  actor: string;
  action: string;
  target: string;
}

export interface AdminAuditRecord extends AdminAuditRecordInput {
  id?: string;
  timestamp: Date;
}

export interface AdminAuditRepository {
  save(record: AdminAuditRecord): Promise<AdminAuditRecord>;
}

@Injectable()
export class AdminAuditService {
  constructor(
    @Inject('AdminAuditRepository')
    private readonly repository: AdminAuditRepository,
    @Inject('Logger')
    private readonly logger: LoggerService,
  ) {}

  async record(input: AdminAuditRecordInput): Promise<AdminAuditRecord> {
    const record: AdminAuditRecord = {
      actor: input.actor,
      action: input.action,
      target: input.target,
      timestamp: new Date(),
    };

    try {
      return await this.repository.save(record);
    } catch (error) {
      this.logger.error(
        `Failed to persist admin audit record for action "${input.action}" on target "${input.target}"`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

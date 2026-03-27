import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditAdminGuard } from './audit-admin.guard';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { AuditLog } from './entities/audit-log.entity';

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-audit-key', required: true })
@Controller({ path: 'admin/audit', version: '1' })
@UseGuards(AuditAdminGuard)
export class AuditAdminController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Query audit log (requires AUDIT_ADMIN_API_KEY)' })
  @ApiResponse({ status: 200, description: 'Paginated audit entries' })
  query(@Query() query: AuditQueryDto): Promise<PaginatedResponseDto<AuditLog>> {
    return this.auditService.query(query);
  }
}

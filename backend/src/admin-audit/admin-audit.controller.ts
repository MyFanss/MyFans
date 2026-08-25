import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuditService } from './admin-audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Read-only, admin-only view of the append-only admin audit log (#1568).
 * There is deliberately no POST/PATCH/DELETE here — rows are written only
 * by internal services (role changes, moderation decisions) via
 * AdminAuditService, never through this controller.
 */
@ApiTags('admin-audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'admin/audit-log', version: '1' })
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[Admin] Paginated append-only audit log of role changes and moderation actions',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  findAll(@Query() query: QueryAuditLogDto) {
    return this.adminAuditService.findPaginated(query);
  }
}

import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { EmailOutboxService } from './email-outbox.service';

@ApiTags('admin / email-outbox')
@ApiBearerAuth()
@Controller({ path: 'admin/email-outbox', version: '1' })
export class EmailOutboxAdminController {
  constructor(private readonly outbox: EmailOutboxService) {}

  @Get('dead-letters')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List dead-letter and failed email entries' })
  async listDeadLetters() {
    return this.outbox.listDeadLetters();
  }

  @Post(':id/replay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Replay a dead-letter email (reset to pending)' })
  async replay(@Param('id') id: string) {
    return this.outbox.replayById(id);
  }
}

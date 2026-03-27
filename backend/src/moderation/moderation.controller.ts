import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { ReviewFlagDto } from './dto/review-flag.dto';
import { QueryFlagsDto } from './dto/query-flags.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'moderation', version: '1' })
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // ── User endpoints ────────────────────────────────────────────────────

  @Post('flags')
  @ApiOperation({ summary: 'Report content for moderation' })
  @ApiResponse({ status: 201, description: 'Flag created' })
  @ApiResponse({ status: 409, description: 'Already flagged' })
  createFlag(@Request() req, @Body() dto: CreateFlagDto) {
    return this.moderationService.createFlag(req.user.id, dto);
  }

  // ── Admin endpoints ───────────────────────────────────────────────────

  @Get('flags')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] List all moderation flags' })
  @ApiResponse({ status: 200, description: 'Paginated flags list' })
  findAll(@Query() query: QueryFlagsDto) {
    return this.moderationService.findAll(query);
  }

  @Get('flags/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Get a single moderation flag' })
  @ApiResponse({ status: 200, description: 'Flag details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.findOne(id);
  }

  @Patch('flags/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Admin] Review / update a moderation flag' })
  @ApiResponse({ status: 200, description: 'Flag updated' })
  reviewFlag(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFlagDto,
  ) {
    return this.moderationService.reviewFlag(req.user.id, id, dto);
  }

  @Get('flags/:id/audit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Get audit trail for a flag' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  getAuditLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.moderationService.getAuditLog(id);
  }
}

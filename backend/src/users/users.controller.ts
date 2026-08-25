import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  UpdateUserRoleDto,
  UserProfileDto,
  DeleteAccountDto,
  UpdateOnboardingDto,
} from './dto';
import { plainToInstance } from 'class-transformer';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth-module/decorators/current-user.decorator';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { RequestContextService } from '../common/services/request-context.service';

/**
 * UsersController
 *
 * Handles user profile CRUD and account management. Protected endpoints
 * use JWT authentication via AuthGuard or @CurrentUser decorator to extract
 * the authenticated user's identity. The updateMe method now uses
 * @CurrentUser instead of a hardcoded temp ID.
 *
 * @Controller users
 * @version 1
 * @tags users
 * @security BearerAuth
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminAuditService: AdminAuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: JwtUserPayload): Promise<UserProfileDto> {
    const found = await this.usersService.findOne(user.userId);
    return plainToInstance(UserProfileDto, found);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMe(
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: { id: string },
  ): Promise<UserProfileDto> {
    const updatedUser = await this.usersService.update(user.id, updateUserDto);
    return plainToInstance(UserProfileDto, updatedUser);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/onboarding')
  @ApiOperation({ summary: 'Update creator onboarding progress' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding progress updated',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateOnboarding(
    @CurrentUser() currentUser: JwtUserPayload,
    @Body() dto: UpdateOnboardingDto,
  ): Promise<UserProfileDto> {
    const user = await this.usersService.updateOnboarding(currentUser.userId, {
      currentStep: dto.currentStep,
      completedSteps: dto.completedSteps,
      skippedSteps: dto.skippedSteps,
      intent: dto.intent ?? null,
      updatedAt: dto.updatedAt,
    });
    return plainToInstance(UserProfileDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/notifications')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  @ApiResponse({ status: 200, description: 'Notification preferences' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(@CurrentUser() user: JwtUserPayload) {
    return this.usersService.getNotificationPreferences(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/notifications')
  @ApiOperation({ summary: 'Update notification preferences for current user' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated' })
  async updateNotifications(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async removeMe(
    @CurrentUser() user: JwtUserPayload,
    @Body() deleteAccountDto: DeleteAccountDto,
  ): Promise<void> {
    const isValid = await this.usersService.validatePassword(
      user.userId,
      deleteAccountDto.password,
    );
    if (!isValid) throw new UnauthorizedException('Invalid password');
    await this.usersService.remove(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/role')
  @ApiOperation({
    summary: '[Admin] Change a user\'s role',
    description:
      'Admin-only. Every role change is written to the append-only admin audit log (#1568), ' +
      'recording the actor, the previous/new role, and the request correlation id.',
  })
  @ApiResponse({ status: 200, description: 'Updated user profile', type: UserProfileDto })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: JwtUserPayload,
  ): Promise<UserProfileDto> {
    const { user, previousRole } = await this.usersService.updateRole(id, dto.role);

    await this.adminAuditService.record({
      actorId: admin.userId,
      action: 'user.role_changed',
      target: id,
      payload: { previousRole, newRole: dto.role },
      correlationId: this.requestContext.getCorrelationId(),
    });

    return plainToInstance(UserProfileDto, user);
  }
}

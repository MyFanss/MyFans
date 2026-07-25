import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseInterceptors,
  ClassSerializerInterceptor,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UserProfileDto, DeleteAccountDto, UpdateOnboardingDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser, JwtUserPayload } from '../auth-module/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: JwtUserPayload): Promise<UserProfileDto> {
    const found = await this.usersService.findOne(user.userId);
    return plainToInstance(UserProfileDto, found);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated user profile', type: UserProfileDto })
  async updateMe(@Body() updateUserDto: UpdateUserDto): Promise<UserProfileDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    const user = await this.usersService.update(userId, updateUserDto);
    return plainToInstance(UserProfileDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/onboarding')
  @ApiOperation({ summary: 'Update creator onboarding progress' })
  @ApiResponse({ status: 200, description: 'Onboarding progress updated', type: UserProfileDto })
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
    const isValid = await this.usersService.validatePassword(user.userId, deleteAccountDto.password);
    if (!isValid) throw new UnauthorizedException('Invalid password');
    await this.usersService.remove(user.userId);
  }
}

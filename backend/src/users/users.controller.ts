import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseInterceptors,
  ClassSerializerInterceptor,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UserProfileDto, DeleteAccountDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { AuthGuard } from '../utils/auth.guard';
import { User } from './entities/user.entity';
import { Delete, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';

@ApiTags('users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Req() req): Promise<UserProfileDto> {
    const userId = req.user.id;
    if (!userId) {
      throw new Error('User ID not found in request');
    }
    const user = await this.usersService.findOne(userId);
    return plainToInstance(UserProfileDto, user);
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

  @Patch('me/notifications')
  @ApiOperation({ summary: 'Update notification preferences for current user' })
  @ApiResponse({ status: 200, description: 'Notification preferences updated' })
  async updateNotifications(
    @Req() req,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.usersService.updateNotificationPreferences(
      req.user.id,
      dto,
    );
  }

  @UseGuards(AuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async removeMe(@Req() req, @Body() deleteAccountDto: DeleteAccountDto): Promise<void> {
    const userId = req.user.id;
    const isValid = await this.usersService.validatePassword(userId, deleteAccountDto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }
    await this.usersService.remove(userId);
  }
}

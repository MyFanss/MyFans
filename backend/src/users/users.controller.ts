import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseInterceptors,
  ClassSerializerInterceptor,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UserProfileDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { Deprecated } from '../common/deprecation';

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Deprecated({
    sunsetDate: '2026-01-01',
    migrationPath: '/users/:id',
    reason: 'Use GET /users/:id with authenticated user ID from JWT.',
  })
  async getMe(): Promise<UserProfileDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    const user = await this.usersService.findOne(userId);
    return plainToInstance(UserProfileDto, user);
  }

  @Patch('me')
  @Deprecated({
    sunsetDate: '2026-01-01',
    migrationPath: '/users/:id',
    reason: 'Use PATCH /users/:id with authenticated user ID from JWT.',
  })
  async updateMe(@Body() updateUserDto: UpdateUserDto): Promise<UserProfileDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    const user = await this.usersService.update(userId, updateUserDto);
    return plainToInstance(UserProfileDto, user);
  }
   @Patch('me/notifications')
  async updateNotifications(
    @Req() req,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.usersService.updateNotificationPreferences(
      req.user.id,
      dto,
    );
  }

  
}

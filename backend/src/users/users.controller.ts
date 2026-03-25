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
import { UsersService } from './users.service';
import { UpdateUserDto, UserProfileDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { AuthGuard } from 'src/utils/auth.guard';
import { User } from './entities/user.entity';

@Controller({ path: 'users', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  @UseGuards(AuthGuard)
  @Get('me')
  async getMe(@Req() req): Promise<UserProfileDto> {
    
    const userId = req.user.id;
    if(!userId) {
      throw new Error('User ID not found in request');
    }
    const user = await this.usersService.findOne(userId);
    return plainToInstance(UserProfileDto, user);
  }

  @Patch('me')
  async updateMe(@Body() updateUserDto: UpdateUserDto): Promise<UserProfileDto> {
    // TODO: Get user ID from auth token/session
    const userId = 'temp-user-id';
    const user = await this.usersService.update(userId, updateUserDto);
    return plainToInstance(UserProfileDto, user);
  }
  @UseGuards(AuthGuard)
  @Get('me/notifications')
  async getNotifications(@Req() req) {
    const user = await this.usersService.findOne(req.user.id);
    return {
      email_notifications: user.email_notifications,
      push_notifications: user.push_notifications,
      marketing_emails: user.marketing_emails,
      email_new_subscriber: user.email_new_subscriber,
      email_subscription_renewal: user.email_subscription_renewal,
      email_new_comment: user.email_new_comment,
      email_new_like: user.email_new_like,
      email_new_message: user.email_new_message,
      email_payout: user.email_payout,
      push_new_subscriber: user.push_new_subscriber,
      push_subscription_renewal: user.push_subscription_renewal,
      push_new_comment: user.push_new_comment,
      push_new_like: user.push_new_like,
      push_new_message: user.push_new_message,
      push_payout: user.push_payout,
    };
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

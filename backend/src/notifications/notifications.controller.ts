import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, MarkReadDto } from './dto/notification.dto';
import { AuthGuard } from 'src/utils/auth.guard';

@Controller({ path: 'notifications', version: '1' })
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req, @Query('unread_only') unreadOnly?: string) {
    return this.notificationsService.findAllForUser(
      req.user.id,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  getUnreadCount(@Req() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.notificationsService.findOne(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch('mark-all-read')
  markAllRead(@Req() req) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.notificationsService.markRead(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req, @Param('id') id: string) {
    return this.notificationsService.remove(id, req.user.id);
  }
}

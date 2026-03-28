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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, MarkReadDto } from './dto/notification.dto';
import { AuthGuard } from 'src/utils/auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiQuery({ name: 'unread_only', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Notifications list' })
  findAll(@Req() req, @Query('unread_only') unreadOnly?: string) {
    return this.notificationsService.findAllForUser(
      req.user.id,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current user' })
  @ApiResponse({ status: 200, description: 'Unread count', schema: { example: { count: 5 } } })
  getUnreadCount(@Req() req) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  findOne(@Req() req, @Param('id') id: string) {
    return this.notificationsService.findOne(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, description: 'Notification created' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllRead(@Req() req) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markRead(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.notificationsService.markRead(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 204, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  remove(@Req() req, @Param('id') id: string) {
    return this.notificationsService.remove(id, req.user.id);
  }
}

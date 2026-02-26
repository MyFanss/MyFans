import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { SubscribeDto } from './dto/subscribe.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  listSubscriptions(
    @CurrentUser() user: User,
    @Query() query: ListSubscriptionsQueryDto,
  ) {
    return this.subscriptionsService.listSubscriptions(user.id, query);
  }

  @Post()
  subscribe(@CurrentUser() user: User, @Body() dto: SubscribeDto) {
    return this.subscriptionsService.subscribe(user, dto);
  }

  @Delete(':id')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.subscriptionsService.cancel(id, user.id);
  }

  @Post(':id/cancel')
  cancelPost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.subscriptionsService.cancel(id, user.id);
  }
}

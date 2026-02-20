import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller()
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:id/comments')
  create(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user, postId, dto);
  }

  @Get('posts/:id/comments')
  findAll(
    @Param('id', ParseUUIDPipe) postId: string,
    @Query() query: GetCommentsQueryDto,
  ) {
    return this.commentsService.findAll(postId, query);
  }

  @Patch('comments/:id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(user, commentId, dto);
  }

  @Delete('comments/:id')
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentsService.delete(user, commentId);
  }
}

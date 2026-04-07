import {
  Controller,
  Get,
  Post as HttpPost,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { FindPostsQueryDto } from './dto/find-posts-query.dto';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { User } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Public()
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120) // 2 minutes
  findAll(@Query() query: FindPostsQueryDto, @CurrentUser() user?: User) {
    return this.postsService.findAll(query, user?.id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: User) {
    return this.postsService.findOne(id, user?.id);
  }

  @HttpPost()
  create(@Body() dto: CreatePostDto, @CurrentUser() user: User) {
    if (!user.is_creator) {
      throw new ForbiddenException('Only creators can create posts');
    }
    return this.postsService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: User,
  ) {
    return this.postsService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postsService.delete(id, user.id);
  }
}

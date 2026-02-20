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
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { FindPostsQueryDto } from './dto/find-posts-query.dto';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120) // 2 minutes (overrides default if needed, though we will set it in module)
  findAll(@Query() query: FindPostsQueryDto) {
    return this.postsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.findOne(id);
  }

  @HttpPost()
  create(@Body() dto: any) {
    // In a real app, we'd get the creator from the current user
    // For now, assume creator is passed or handled in service
    return this.postsService.create(null, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.postsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.postsService.delete(id);
  }
}


import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { AuthGuard } from '../auth/auth.guard';

import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreatorsService } from './creators.service';
import { FindCreatorsQueryDto } from './dto/find-creators-query.dto';
import { OnboardCreatorDto } from './dto/onboard-creator.dto';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post('onboard')
  @UseGuards(AuthGuard)
  onboard(@Body() dto: OnboardCreatorDto, @CurrentUser() user: User) {
    return this.creatorsService.onboard(user.id, dto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  findAll(@Query() query: FindCreatorsQueryDto) {
    return this.creatorsService.findAll(query);
  }

  @Get('by-username/:username')
  findOneByUsername(@Param('username') username: string) {
    return this.creatorsService.findOneByUsername(username);
  }

  @Get(':id')
  findOneById(@Param('id', ParseUUIDPipe) id: string) {
    return this.creatorsService.findOneById(id);
  }

  @Post(':id/follow')
  @UseGuards(AuthGuard)
  follow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.creatorsService.follow(id, user.id);
  }

  @Delete(':id/follow')
  @UseGuards(AuthGuard)
  unfollow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.creatorsService.unfollow(id, user.id);
  }
}

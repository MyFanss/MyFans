import {
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
import { CreatorsService } from './creators.service';
import { FindCreatorsQueryDto } from './dto/find-creators-query.dto';

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
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
  follow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.creatorsService.follow(id, user.id);
  }

  @Delete(':id/follow')
  @UseGuards(AuthGuard)
  unfollow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.creatorsService.unfollow(id, user.id);
  }
}

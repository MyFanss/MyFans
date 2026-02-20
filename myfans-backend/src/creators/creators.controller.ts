import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
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
}

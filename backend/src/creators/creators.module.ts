import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { User } from '../users/entities/user.entity';
import { Creator } from './entities/creator.entity.ts_';

@Module({
  imports: [TypeOrmModule.forFeature([User, Creator])],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from './entities/creator.entity';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';

@Module({
  imports: [TypeOrmModule.forFeature([Creator])],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}

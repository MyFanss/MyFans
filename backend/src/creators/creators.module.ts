import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { EventsModule } from '../events/events.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [EventsModule, TypeOrmModule.forFeature([User])],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}

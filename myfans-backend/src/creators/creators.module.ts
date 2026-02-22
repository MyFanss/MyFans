import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from './entities/creator.entity';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Creator, Follow, User]),
    AuthModule,
    UsersModule,
  ],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}

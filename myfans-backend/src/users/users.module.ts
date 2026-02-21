import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from '../creators/entities/creator.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Creator])],
  providers: [UsersService],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule { }

import { Injectable, NotFoundException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  register(registerDto: RegisterDto) {
    throw new Error('Method not implemented.');
  }

  async validateUser(userId: string) {
    try {
      return await this.usersService.findOne(userId);
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }
  }
}

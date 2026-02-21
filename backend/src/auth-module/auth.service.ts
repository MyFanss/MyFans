import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  register(registerDto: RegisterDto) {
    throw new Error('Method not implemented.');
  }

  async validateUser(userId: string): Promise<User | null> {
    try {
      return await this.usersService.findOne(userId);
    } catch {
      return null;
    }
  }
}

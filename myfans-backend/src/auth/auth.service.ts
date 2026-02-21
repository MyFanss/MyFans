import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(private readonly usersService: UsersService) { }

    async register(email: string, username: string): Promise<User> {
        const existing = await this.usersService.findOneByEmail(email);
        if (existing) {
            throw new ConflictException('Email already exists');
        }
        return this.usersService.create({ email, username });
    }

    async login(email: string): Promise<{ userId: string; token: string }> {
        const user = await this.usersService.findOneByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        // Simple token implementation for setup: token is the user ID
        return { userId: user.id, token: user.id };
    }
}

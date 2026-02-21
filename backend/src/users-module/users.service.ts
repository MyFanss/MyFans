import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';

import { User } from './user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { UserProfileDto, PaginationDto, PaginatedUsersDto } from './user-profile.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toProfile(user: User): UserProfileDto {
    return plainToInstance(UserProfileDto, user, { excludeExtraneousValues: true });
  }

  private async assertEmailUnique(email: string, excludeId?: string): Promise<void> {
    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where('u.email = :email', { email })
      .withDeleted();

    if (excludeId) qb.andWhere('u.id != :excludeId', { excludeId });

    const existing = await qb.getOne();
    if (existing) throw new ConflictException('Email is already in use');
  }

  private async assertUsernameUnique(username: string, excludeId?: string): Promise<void> {
    const qb = this.usersRepository
      .createQueryBuilder('u')
      .where('u.username = :username', { username })
      .withDeleted();

    if (excludeId) qb.andWhere('u.id != :excludeId', { excludeId });

    const existing = await qb.getOne();
    if (existing) throw new ConflictException('Username is already taken');
  }

  private async findOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with id "${id}" not found`);
    return user;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreateUserDto): Promise<UserProfileDto> {
    // Run uniqueness checks in parallel
    await Promise.all([
      this.assertEmailUnique(dto.email),
      this.assertUsernameUnique(dto.username),
    ]);

    return this.dataSource.transaction(async (manager) => {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      const user = manager.create(User, {
        email: dto.email.toLowerCase().trim(),
        username: dto.username.trim(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });

      const saved = await manager.save(User, user);
      return this.toProfile(saved);
    });
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedUsersDto> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [users, total] = await this.usersRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: users.map((u) => this.toProfile(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<UserProfileDto> {
    const user = await this.findOrFail(id);
    return this.toProfile(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserProfileDto> {
    const user = await this.findOrFail(id);

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      await this.assertEmailUnique(dto.email, id);
    }

    if (dto.username && dto.username !== user.username) {
      await this.assertUsernameUnique(dto.username, id);
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.email) user.email = dto.email.toLowerCase().trim();
      if (dto.username) user.username = dto.username.trim();
      if (dto.firstName !== undefined) user.firstName = dto.firstName;
      if (dto.lastName !== undefined) user.lastName = dto.lastName;
      if (dto.password) {
        user.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      }

      const updated = await manager.save(User, user);
      return this.toProfile(updated);
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOrFail(id);
    await this.usersRepository.softDelete(user.id);
  }

  // ─── Internal helpers (for auth module) ───────────────────────────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}

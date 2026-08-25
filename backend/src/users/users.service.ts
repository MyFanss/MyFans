import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { Creator } from './entities/creator.entity';
import { AccountDeletionAuditLog } from './entities/account-deletion-audit-log.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { WalletLinksService } from '../wallet-links/wallet-links.service';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(User)
    private creatorRepository: Repository<Creator>,
    @InjectRepository(AccountDeletionAuditLog)
    private accountDeletionAuditLogRepository: Repository<AccountDeletionAuditLog>,
    private readonly walletLinksService: WalletLinksService,
  ) { }

  async findAll(
    pagination: PaginationDto,
  ): Promise<{ data: User[]; total: number }> {
    const limit = pagination.limit ?? 20;
    const page = pagination.page ?? 1;
    const skip = (page - 1) * limit;

    const [data, total] = await this.usersRepository.findAndCount({
      take: limit,
      skip,
      order: { created_at: 'DESC' },
    });

    return { data, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async updateOnboarding(
    id: string,
    onboarding: {
      currentStep?: string;
      completedSteps?: string[];
      skippedSteps?: string[];
      intent?: string | null;
      updatedAt?: string;
    },
  ): Promise<User> {
    const user = await this.findOne(id);
    const prev = user.onboarding_state ?? null;
    user.onboarding_state = {
      currentStep: onboarding.currentStep ?? prev?.currentStep ?? 'account-type',
      completedSteps: onboarding.completedSteps ?? prev?.completedSteps ?? [],
      skippedSteps: onboarding.skippedSteps ?? prev?.skippedSteps ?? [],
      intent:
        onboarding.intent ??
        prev?.intent ??
        null,
      updatedAt: onboarding.updatedAt ?? new Date().toISOString(),
    };
    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private notificationPreferencesFromUser(user: User) {
    return {
      email_notifications: user.email_notifications,
      push_notifications: user.push_notifications,
      marketing_emails: user.marketing_emails,
      email_new_subscriber: user.email_new_subscriber,
      email_subscription_renewal: user.email_subscription_renewal,
      email_new_comment: user.email_new_comment,
      email_new_like: user.email_new_like,
      email_new_message: user.email_new_message,
      email_payout: user.email_payout,
      push_new_subscriber: user.push_new_subscriber,
      push_subscription_renewal: user.push_subscription_renewal,
      push_new_comment: user.push_new_comment,
      push_new_like: user.push_new_like,
      push_new_message: user.push_new_message,
      push_payout: user.push_payout,
    };
  }

  async getNotificationPreferences(userId: string) {
    const user = await this.findById(userId);
    return this.notificationPreferencesFromUser(user);
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationsDto,
  ) {
    const user = await this.findById(userId);

    Object.assign(user, dto);
    await this.usersRepository.save(user);

    return {
      message: 'Notification preferences updated successfully',
      preferences: this.notificationPreferencesFromUser(user),
    };
  }

  async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'password_hash'],
    });
    if (!user) return false;
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Deletes a user's account (#1566). This is an off-chain, platform-side
   * deletion only:
   *
   *  - Soft-deletes the `users` row.
   *  - Bumps `token_version` so every JWT already issued to this user fails
   *    the version check in `JwtStrategy#validate` on its next use — this
   *    revokes all existing sessions without needing a token blocklist.
   *  - Deletes the user's wallet links (so a future caller can't be bridged
   *    into a deleted account's identity via #1561's wallet-address
   *    resolution) and resets their notification preferences.
   *  - Writes an audit log entry.
   *
   * IMPORTANT: this does NOT cancel any on-chain Soroban subscription the
   * user holds as a fan, and does NOT touch the subscription smart
   * contract in any way. On-chain subscriptions are controlled by the
   * user's Stellar wallet, not this backend, and can only be cancelled by
   * the user signing an explicit cancel transaction. Deletion only stops
   * off-chain effects: login/session validity, wallet-address bridging,
   * and email/notification reminders (see EmailOutboxService).
   */
  async remove(userId: string): Promise<void> {
    const user = await this.findOne(userId);

    user.token_version = (user.token_version ?? 0) + 1;
    Object.assign(user, this.disabledNotificationPreferences());
    await this.usersRepository.save(user);

    await this.walletLinksService.deleteAllForUser(user.id);

    await this.usersRepository.softDelete(user.id);

    await this.accountDeletionAuditLogRepository.save({
      user_id: user.id,
      details:
        'Account deleted: sessions revoked (token_version bumped), wallet links removed, ' +
        'notification preferences cleared. On-chain subscriptions, if any, are unaffected ' +
        'and require an explicit on-chain cancel transaction from the user.',
    });
  }

  private disabledNotificationPreferences() {
    return {
      email_notifications: false,
      push_notifications: false,
      marketing_emails: false,
      email_new_subscriber: false,
      email_subscription_renewal: false,
      email_new_comment: false,
      email_new_like: false,
      email_new_message: false,
      email_payout: false,
      push_new_subscriber: false,
      push_subscription_renewal: false,
      push_new_comment: false,
      push_new_like: false,
      push_new_message: false,
      push_payout: false,
    };
  }
}


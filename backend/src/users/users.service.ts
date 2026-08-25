import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UpdateUserDto } from './dto';
import { ONBOARDING_STEPS } from './dto/update-onboarding.dto';
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

  /**
   * Resolves a Stellar G-address (as seen on-chain / in subscription
   * lifecycle events) to the platform user UUID it is linked to.
   *
   * There is currently no persisted wallet-link table connecting a `users`
   * row to a Stellar address (see `HybridFanAuthGuard`'s doc comment), so
   * this always returns `null` today — callers MUST treat that as "unlinked"
   * and must never fall back to using the raw address as a user id (e.g. as
   * a notification/outbox recipient). Once a wallet-link table exists, this
   * is the single place to update to query it.
   */
  async findByStellarAddress(_stellarAddress: string): Promise<User | null> {
    void _stellarAddress;
    return null;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  /**
   * Changes a user's role. Callers are responsible for authorization
   * (enforced via @Roles(ADMIN) on the controller) and for recording the
   * change in the append-only admin audit log (#1568) — this method just
   * returns the previous role so the caller can log an accurate diff.
   */
  async updateRole(
    id: string,
    role: UserRole,
  ): Promise<{ user: User; previousRole: UserRole }> {
    const user = await this.findOne(id);
    const previousRole = user.role;
    user.role = role;
    const saved = await this.usersRepository.save(user);
    return { user: saved, previousRole };
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
    const completedSteps = onboarding.completedSteps ?? prev?.completedSteps ?? [];
    const skippedSteps = onboarding.skippedSteps ?? prev?.skippedSteps ?? [];
    const currentStep = onboarding.currentStep ?? prev?.currentStep ?? 'account-type';

    this.assertLegalOnboardingTransition(completedSteps, skippedSteps, currentStep);

    user.onboarding_state = {
      currentStep,
      completedSteps,
      skippedSteps,
      intent:
        onboarding.intent ??
        prev?.intent ??
        null,
      updatedAt: onboarding.updatedAt ?? new Date().toISOString(),
    };
    return this.usersRepository.save(user);
  }

  /**
   * Onboarding steps must be completed/skipped in order — a step can only
   * be marked handled (completed or skipped) once every step before it in
   * `ONBOARDING_STEPS` is also handled. This rejects a client sending a
   * `currentStep`/`completedSteps`/`skippedSteps` payload that skips ahead
   * without going through the earlier steps (e.g. jumping straight to
   * `verification`).
   */
  private assertLegalOnboardingTransition(
    completedSteps: string[],
    skippedSteps: string[],
    currentStep: string,
  ): void {
    const handled = new Set([...completedSteps, ...skippedSteps]);
    const order = ONBOARDING_STEPS as readonly string[];

    let maxHandledIndex = -1;
    for (const step of handled) {
      const idx = order.indexOf(step);
      if (idx === -1) continue; // caught by DTO validation already
      maxHandledIndex = Math.max(maxHandledIndex, idx);
    }

    // Every step up to the furthest handled one must also be handled —
    // no gaps allowed.
    for (let i = 0; i <= maxHandledIndex; i += 1) {
      if (!handled.has(order[i])) {
        throw new BadRequestException(
          `Cannot skip onboarding step "${order[i]}" — steps must be completed or skipped in order.`,
        );
      }
    }

    // currentStep may not point further ahead than "next after the last handled step".
    const currentIdx = order.indexOf(currentStep);
    if (currentIdx !== -1 && currentIdx > maxHandledIndex + 1) {
      throw new BadRequestException(
        `Cannot jump to onboarding step "${currentStep}" before earlier steps are handled.`,
      );
    }
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


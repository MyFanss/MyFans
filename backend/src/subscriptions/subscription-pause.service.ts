import { Injectable, Logger } from '@nestjs/common';

export interface PauseState {
  paused: boolean;
  pausedAt?: string;
  pausedBy?: string;
  reason?: string;
}

/**
 * Manages the paused state of the subscription contract.
 *
 * In a production system, this would:
 * 1. Invoke the contract's pause/unpause methods directly (requires admin keys)
 * 2. Query the contract's paused flag as the source of truth
 *
 * For now, this service maintains in-memory state. The actual pause/unpause
 * methods should be implemented as contract invocations or documented as
 * stellar-cli commands (if admin keys are kept offline).
 */
@Injectable()
export class SubscriptionPauseService {
  private readonly logger = new Logger(SubscriptionPauseService.name);
  private paused = false;
  private pausedAt?: Date;
  private pausedBy?: string;
  private reason?: string;

  getState(): PauseState {
    return {
      paused: this.paused,
      pausedAt: this.pausedAt?.toISOString(),
      pausedBy: this.pausedBy,
      reason: this.reason,
    };
  }

  /**
   * Pause subscriptions. Only callable by admin.
   * @param adminAddress The admin address performing this action.
   * @param reason Optional reason for the pause (logged).
   */
  pause(adminAddress: string, reason?: string): PauseState {
    if (this.paused) {
      this.logger.warn(`Pause requested but subscriptions already paused`);
      return this.getState();
    }

    this.paused = true;
    this.pausedAt = new Date();
    this.pausedBy = adminAddress;
    this.reason = reason;

    this.logger.warn(
      `Subscriptions paused by ${adminAddress}${reason ? `: ${reason}` : ''}`,
    );

    return this.getState();
  }

  /**
   * Unpause subscriptions. Only callable by admin.
   * @param adminAddress The admin address performing this action.
   */
  unpause(adminAddress: string): PauseState {
    if (!this.paused) {
      this.logger.warn(`Unpause requested but subscriptions not paused`);
      return this.getState();
    }

    const wasPausedFor = Date.now() - this.pausedAt!.getTime();
    this.paused = false;
    this.pausedAt = undefined;
    this.pausedBy = undefined;
    this.reason = undefined;

    this.logger.log(
      `Subscriptions unpaused by ${adminAddress} after ${wasPausedFor}ms`,
    );

    return this.getState();
  }

  isPaused(): boolean {
    return this.paused;
  }
}

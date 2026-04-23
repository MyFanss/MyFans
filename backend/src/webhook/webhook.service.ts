import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSecretState {
  active: string;
  previous?: string;
  /** Unix ms — previous secret is accepted until this time */
  cutoffAt?: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private state: WebhookSecretState;

  constructor(activeSecret?: string) {
    this.state = { active: activeSecret ?? process.env.WEBHOOK_SECRET ?? '' };
  }

  /**
   * Rotate to a new secret. The previous secret remains valid for `cutoffMs`
   * milliseconds (default 24 h) so in-flight webhooks are not rejected.
   */
  rotate(newSecret: string, cutoffMs = 24 * 60 * 60 * 1000): void {
    this.state = {
      active: newSecret,
      previous: this.state.active,
      cutoffAt: Date.now() + cutoffMs,
    };
    this.logger.log('Webhook secret rotated; previous secret valid until cutoff.');
  }

  /** Immediately invalidate the previous secret. */
  expirePrevious(): void {
    this.state = { active: this.state.active };
    this.logger.log('Previous webhook secret expired.');
  }

  getState(): Readonly<WebhookSecretState> {
    return { ...this.state };
  }

  sign(payload: string): string {
    return this.hmac(this.state.active, payload);
  }

  /**
   * Verify a signature against the active secret, then (if within cutoff)
   * the previous secret. Returns true if either matches.
   */
  verify(payload: string, signature: string): boolean {
    if (this.safeCompare(this.hmac(this.state.active, payload), signature)) {
      return true;
    }

    if (
      this.state.previous &&
      this.state.cutoffAt &&
      Date.now() < this.state.cutoffAt &&
      this.safeCompare(this.hmac(this.state.previous, payload), signature)
    ) {
      this.logger.warn('Webhook verified with previous secret — rotate your client key.');
      return true;
    }

    return false;
  }

  private hmac(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private safeCompare(a: string, b: string): boolean {
    try {
      return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
      return false;
    }
  }
}

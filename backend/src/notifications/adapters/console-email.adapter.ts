import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { EmailAdapter, EmailMessage, EmailSendResult } from './email-adapter.interface';

/** Default adapter: logs the email instead of sending it. Safe for dev/test. */
@Injectable()
export class ConsoleEmailAdapter implements EmailAdapter {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const messageId = `console-${crypto.randomUUID()}`;
    this.logger.log(
      `[console-email] id=${messageId} to=${message.to} subject="${message.subject}" body="${message.body}"`,
    );
    return { messageId };
  }
}

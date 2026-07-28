import { Injectable, Logger } from '@nestjs/common';
import { EmailAdapter, EmailMessage } from './email-adapter.interface';

/** Default adapter: logs the email instead of sending it. Safe for dev/test. */
@Injectable()
export class ConsoleEmailAdapter implements EmailAdapter {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[console-email] to=${message.to} subject="${message.subject}" body="${message.body}"`,
    );
  }
}

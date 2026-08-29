export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSendResult {
  messageId?: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** DI token — inject with `@Inject(EMAIL_ADAPTER)`. */
export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');

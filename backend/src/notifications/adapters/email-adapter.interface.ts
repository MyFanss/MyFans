export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>;
}

/** DI token — inject with `@Inject(EMAIL_ADAPTER)`. */
export const EMAIL_ADAPTER = Symbol('EMAIL_ADAPTER');

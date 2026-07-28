import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as tls from 'tls';
import { EmailAdapter, EmailMessage } from './email-adapter.interface';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

/**
 * Minimal SMTP client built directly on Node's `net`/`tls` sockets — no
 * external mail library. Supports plaintext or implicit-TLS connections and
 * optional `AUTH LOGIN`.
 *
 * This is intentionally a basic stub, not a full RFC 5321 client: no
 * STARTTLS upgrade, no multi-recipient batching, no MIME attachments, and
 * each server reply is assumed to arrive in a single TCP chunk (true for
 * every common relay in practice, but not guaranteed by the protocol).
 * Swap in a hardened library-backed adapter before relying on this for
 * production mail volume.
 *
 * Configure via env: `SMTP_HOST`, `SMTP_PORT` (default 25), `SMTP_SECURE`
 * ('true' for implicit TLS), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
 */
@Injectable()
export class SmtpEmailAdapter implements EmailAdapter {
  private readonly logger = new Logger(SmtpEmailAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    const config = this.readConfig();
    const socket = await this.connect(config);

    try {
      await this.expect(socket, 220);
      await this.command(socket, `EHLO ${config.host}`, 250);

      if (config.user && config.pass) {
        await this.command(socket, 'AUTH LOGIN', 334);
        await this.command(socket, Buffer.from(config.user).toString('base64'), 334);
        await this.command(socket, Buffer.from(config.pass).toString('base64'), 235);
      }

      await this.command(socket, `MAIL FROM:<${config.from}>`, 250);
      await this.command(socket, `RCPT TO:<${message.to}>`, 250);
      await this.command(socket, 'DATA', 354);

      const data = this.buildMessage(config.from, message);
      await this.command(socket, `${data}\r\n.`, 250);
      await this.command(socket, 'QUIT', 221);

      this.logger.log(`[smtp-email] delivered to=${message.to} via ${config.host}:${config.port}`);
    } finally {
      socket.destroy();
    }
  }

  private readConfig(): SmtpConfig {
    const host = this.configService.get<string>('SMTP_HOST');
    if (!host) {
      throw new Error('SmtpEmailAdapter requires SMTP_HOST to be configured');
    }
    return {
      host,
      port: Number(this.configService.get<string>('SMTP_PORT') ?? 25),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      user: this.configService.get<string>('SMTP_USER'),
      pass: this.configService.get<string>('SMTP_PASS'),
      from: this.configService.get<string>('SMTP_FROM') ?? 'no-reply@myfans.app',
    };
  }

  private connect(config: SmtpConfig): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        socket.removeListener('error', onInitialError);
        resolve(socket);
      };
      const onInitialError = (error: Error) => reject(error);

      const socket: net.Socket = config.secure
        ? tls.connect({ host: config.host, port: config.port }, onConnect)
        : net.connect({ host: config.host, port: config.port }, onConnect);

      socket.once('error', onInitialError);
      socket.setTimeout(10_000, () => {
        socket.destroy();
        reject(new Error('SMTP connection timed out'));
      });
    });
  }

  private command(socket: net.Socket, line: string, expectedCode: number): Promise<string> {
    socket.write(`${line}\r\n`);
    return this.expect(socket, expectedCode);
  }

  private expect(socket: net.Socket, expectedCode: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        cleanup();
        const response = chunk.toString('utf8');
        const code = Number(response.slice(0, 3));
        if (code !== expectedCode) {
          reject(new Error(`SMTP server responded "${response.trim()}", expected ${expectedCode}`));
          return;
        }
        resolve(response);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        socket.removeListener('data', onData);
        socket.removeListener('error', onError);
      };
      socket.once('data', onData);
      socket.once('error', onError);
    });
  }

  private buildMessage(from: string, message: EmailMessage): string {
    return [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.body,
    ].join('\r\n');
  }
}

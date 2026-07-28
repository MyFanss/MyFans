import * as net from 'net';
import { SmtpEmailAdapter } from './smtp-email.adapter';

function startFakeSmtpServer(
  responses: string[],
): Promise<{ server: net.Server; port: number; received: string[] }> {
  return new Promise((resolve) => {
    const received: string[] = [];
    let step = 0;
    const server = net.createServer((socket) => {
      socket.write(responses[step++]);
      socket.on('data', (chunk) => {
        received.push(chunk.toString('utf8'));
        if (step < responses.length) {
          socket.write(responses[step++]);
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port, received });
    });
  });
}

const makeConfigService = (overrides: Record<string, string | undefined> = {}) => ({
  get: jest.fn((key: string) => overrides[key]),
});

describe('SmtpEmailAdapter', () => {
  it('throws when SMTP_HOST is not configured', async () => {
    const adapter = new SmtpEmailAdapter(makeConfigService() as any);
    await expect(
      adapter.send({ to: 'fan@example.com', subject: 'Hi', body: 'Body' }),
    ).rejects.toThrow('SmtpEmailAdapter requires SMTP_HOST');
  });

  it('completes a full SMTP conversation against a local test server', async () => {
    const { server, port, received } = await startFakeSmtpServer([
      '220 localhost ESMTP\r\n',
      '250-localhost\r\n250 OK\r\n',
      '250 OK\r\n',
      '250 OK\r\n',
      '354 Start mail input\r\n',
      '250 OK\r\n',
      '221 Bye\r\n',
    ]);

    const configService = makeConfigService({
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(port),
      SMTP_FROM: 'no-reply@myfans.app',
    });
    const adapter = new SmtpEmailAdapter(configService as any);

    await expect(
      adapter.send({ to: 'fan@example.com', subject: 'Hello', body: 'World' }),
    ).resolves.toBeUndefined();

    expect(received.some((line) => line.startsWith('EHLO'))).toBe(true);
    expect(received.some((line) => line.includes('MAIL FROM:<no-reply@myfans.app>'))).toBe(true);
    expect(received.some((line) => line.includes('RCPT TO:<fan@example.com>'))).toBe(true);
    expect(received.some((line) => line.includes('Subject: Hello'))).toBe(true);

    server.close();
  });

  it('rejects when the server responds with an unexpected code', async () => {
    const { server, port } = await startFakeSmtpServer([
      '220 localhost ESMTP\r\n',
      '550 Rejected\r\n',
    ]);

    const configService = makeConfigService({
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(port),
    });
    const adapter = new SmtpEmailAdapter(configService as any);

    await expect(
      adapter.send({ to: 'fan@example.com', subject: 'Hi', body: 'Body' }),
    ).rejects.toThrow(/SMTP server responded/);

    server.close();
  });
});

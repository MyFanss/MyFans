import { ConsoleEmailAdapter } from './console-email.adapter';

describe('ConsoleEmailAdapter', () => {
  it('logs the message and resolves without throwing', async () => {
    const adapter = new ConsoleEmailAdapter();
    await expect(
      adapter.send({ to: 'fan@example.com', subject: 'Hello', body: 'World' }),
    ).resolves.toBeUndefined();
  });
});

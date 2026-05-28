/**
 * Tests for secure logger redaction
 */

import { logger } from '../logger';

describe('Logger Redaction', () => {
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleLog = jest.spyOn(console, 'log').mockImplementation();
    consoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  it('redacts tokens', () => {
    logger.info('Auth', { token: 'secret_token_12345678' });
    expect(consoleLog).toHaveBeenCalledWith('[INFO] Auth', expect.objectContaining({
      token: 'secr...5678'
    }));
  });

  it('redacts wallet addresses', () => {
    logger.info('Wallet', { address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H' });
    expect(consoleLog).toHaveBeenCalledWith('[INFO] Wallet', expect.objectContaining({
      address: 'GBRP...OX2H'
    }));
  });

  it('redacts emails', () => {
    logger.info('User', { email: 'user@example.com' });
    expect(consoleLog).toHaveBeenCalledWith('[INFO] User', expect.objectContaining({
      email: 'us***@example.com'
    }));
  });

  it('redacts private keys', () => {
    logger.error('Key error', { privateKey: 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' });
    expect(consoleError).toHaveBeenCalledWith('[ERROR] Key error', expect.objectContaining({
      privateKey: expect.stringContaining('...')
    }));
  });

  it('redacts nested objects', () => {
    logger.info('Nested', { user: { email: 'test@test.com', token: 'abc123xyz' } });
    expect(consoleLog).toHaveBeenCalledWith('[INFO] Nested', expect.objectContaining({
      user: expect.objectContaining({
        email: expect.stringContaining('***'),
        token: expect.stringContaining('...')
      })
    }));
  });
});

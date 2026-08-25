import { validateRequiredSecrets } from './secrets-validation';

describe('secrets-validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment to a clean state
    jest.resetModules();
    process.env = {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-1234567890abcdef',
      WEBHOOK_SECRET: 'test-webhook-secret-1234567890abcdef',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('in test environment', () => {
    it('allows test with CI placeholder values', () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'ci-test-secret-not-for-production';
      process.env.WEBHOOK_SECRET = 'ci-webhook-secret-not-for-production';

      // Should not throw
      expect(() => validateRequiredSecrets()).not.toThrow();
    });

    it('allows test with real secret values', () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'real-secret-for-testing-1234567890abcdef';
      process.env.WEBHOOK_SECRET = 'real-webhook-secret-for-testing-1234567890abcdef';

      expect(() => validateRequiredSecrets()).not.toThrow();
    });
  });

  describe('in development environment', () => {
    it('allows development with CI placeholder values', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'ci-test-secret-not-for-production';
      process.env.WEBHOOK_SECRET = 'ci-webhook-secret-not-for-production';

      expect(() => validateRequiredSecrets()).not.toThrow();
    });
  });

  describe('in production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('rejects missing JWT_SECRET', () => {
      delete process.env.JWT_SECRET;

      expect(() => validateRequiredSecrets()).toThrow(
        /Missing required environment variables/,
      );
      expect(() => validateRequiredSecrets()).toThrow(/JWT_SECRET/);
    });

    it('rejects missing WEBHOOK_SECRET', () => {
      delete process.env.WEBHOOK_SECRET;

      expect(() => validateRequiredSecrets()).toThrow(
        /Missing required environment variables/,
      );
      expect(() => validateRequiredSecrets()).toThrow(/WEBHOOK_SECRET/);
    });

    it('rejects empty JWT_SECRET', () => {
      process.env.JWT_SECRET = '';

      expect(() => validateRequiredSecrets()).toThrow(
        /Missing required environment variables/,
      );
    });

    it('rejects whitespace-only JWT_SECRET', () => {
      process.env.JWT_SECRET = '   ';

      expect(() => validateRequiredSecrets()).toThrow(
        /Missing required environment variables/,
      );
    });

    it('rejects CI default JWT_SECRET in production', () => {
      process.env.JWT_SECRET = 'ci-test-secret-not-for-production';

      expect(() => validateRequiredSecrets()).toThrow(
        /Production rejected CI placeholder secrets/,
      );
      expect(() => validateRequiredSecrets()).toThrow(/JWT_SECRET/);
    });

    it('rejects CI default WEBHOOK_SECRET in production', () => {
      process.env.WEBHOOK_SECRET = 'ci-webhook-secret-not-for-production';

      expect(() => validateRequiredSecrets()).toThrow(
        /Production rejected CI placeholder secrets/,
      );
      expect(() => validateRequiredSecrets()).toThrow(/WEBHOOK_SECRET/);
    });

    it('rejects both CI defaults if both are CI placeholders', () => {
      process.env.JWT_SECRET = 'ci-test-secret-not-for-production';
      process.env.WEBHOOK_SECRET = 'ci-webhook-secret-not-for-production';

      expect(() => validateRequiredSecrets()).toThrow(
        /Production rejected CI placeholder secrets/,
      );

      const error = new Error();
      try {
        validateRequiredSecrets();
      } catch (e) {
        const errorMsg = (e as Error).message;
        expect(errorMsg).toContain('JWT_SECRET');
        expect(errorMsg).toContain('WEBHOOK_SECRET');
      }
    });

    it('accepts real secret values', () => {
      process.env.JWT_SECRET = 'real-secret-1234567890abcdef-production-value';
      process.env.WEBHOOK_SECRET =
        'real-webhook-secret-1234567890abcdef-production-value';

      expect(() => validateRequiredSecrets()).not.toThrow();
    });

    it('accepts CI default JWT_SECRET if WEBHOOK_SECRET is real', () => {
      process.env.JWT_SECRET = 'ci-test-secret-not-for-production';
      process.env.WEBHOOK_SECRET =
        'real-webhook-secret-1234567890abcdef-production-value';

      expect(() => validateRequiredSecrets()).toThrow(
        /Production rejected CI placeholder secrets/,
      );
    });
  });

  describe('logging', () => {
    it('logs config ok on successful validation', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'test';

      validateRequiredSecrets();

      expect(consoleSpy).toHaveBeenCalledWith('[config] validation ok');
      consoleSpy.mockRestore();
    });

    it('does not print secret values in error messages', () => {
      process.env.JWT_SECRET = 'super-secret-key-value-1234567890abcdef';
      process.env.WEBHOOK_SECRET = 'super-webhook-key-1234567890abcdef';
      process.env.NODE_ENV = 'production';

      try {
        validateRequiredSecrets();
      } catch (e) {
        const errorMsg = (e as Error).message;
        expect(errorMsg).not.toContain('super-secret');
        expect(errorMsg).not.toContain('super-webhook');
      }
    });
  });
});

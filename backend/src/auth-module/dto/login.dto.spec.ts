import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(LoginDto, plain);
    return validate(dto);
  }

  describe('email', () => {
    it('accepts a valid email', async () => {
      const errors = await validateDto({
        email: 'user@example.com',
        username: 'user1',
        password: 'pass123',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid email', async () => {
      const errors = await validateDto({
        email: 'not-an-email',
        username: 'user1',
        password: 'pass123',
      });
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find((e) => e.property === 'email');
      expect(emailError).toBeDefined();
      expect(emailError?.constraints).toHaveProperty('isEmail');
    });

    it('rejects missing email', async () => {
      const errors = await validateDto({
        username: 'user1',
        password: 'pass123',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });
  });

  describe('username', () => {
    it('rejects non-string username', async () => {
      const errors = await validateDto({
        email: 'a@b.com',
        username: 123,
        password: 'pass123',
      });
      expect(errors.length).toBeGreaterThan(0);
      const usernameError = errors.find((e) => e.property === 'username');
      expect(usernameError).toBeDefined();
      expect(usernameError?.constraints).toHaveProperty('isString');
    });

    it('rejects missing username', async () => {
      const errors = await validateDto({
        email: 'a@b.com',
        password: 'pass123',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });
  });

  describe('password', () => {
    it('rejects non-string password', async () => {
      const errors = await validateDto({
        email: 'a@b.com',
        username: 'user1',
        password: 12345,
      });
      expect(errors.length).toBeGreaterThan(0);
      const pwError = errors.find((e) => e.property === 'password');
      expect(pwError).toBeDefined();
      expect(pwError?.constraints).toHaveProperty('isString');
    });

    it('rejects missing password', async () => {
      const errors = await validateDto({
        email: 'a@b.com',
        username: 'user1',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });

  describe('combined validation', () => {
    it('reports multiple errors at once', async () => {
      const errors = await validateDto({});
      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
      expect(errors.some((e) => e.property === 'username')).toBe(true);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });
});

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';
import { UserRole } from '../../common/enums';

describe('RegisterDto', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(RegisterDto, plain);
    return validate(dto);
  }

  const validPayload = {
    email: 'user@example.com',
    password: 'securePass1',
    firstName: 'Jane',
    lastName: 'Doe',
  };

  it('accepts a fully valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  describe('email', () => {
    it('rejects invalid email', async () => {
      const errors = await validateDto({ ...validPayload, email: 'bad' });
      const err = errors.find((e) => e.property === 'email');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isEmail');
    });

    it('rejects missing email', async () => {
      const { email, ...rest } = validPayload;
      const errors = await validateDto(rest);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });
  });

  describe('password', () => {
    it('rejects password shorter than 8 characters', async () => {
      const errors = await validateDto({ ...validPayload, password: 'short' });
      const err = errors.find((e) => e.property === 'password');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('minLength');
    });

    it('accepts password with exactly 8 characters', async () => {
      const errors = await validateDto({
        ...validPayload,
        password: '12345678',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects non-string password', async () => {
      const errors = await validateDto({ ...validPayload, password: 12345678 });
      const err = errors.find((e) => e.property === 'password');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isString');
    });
  });

  describe('firstName', () => {
    it('rejects missing firstName', async () => {
      const { firstName, ...rest } = validPayload;
      const errors = await validateDto(rest);
      expect(errors.some((e) => e.property === 'firstName')).toBe(true);
    });

    it('rejects non-string firstName', async () => {
      const errors = await validateDto({ ...validPayload, firstName: 123 });
      const err = errors.find((e) => e.property === 'firstName');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isString');
    });
  });

  describe('lastName', () => {
    it('rejects missing lastName', async () => {
      const { lastName, ...rest } = validPayload;
      const errors = await validateDto(rest);
      expect(errors.some((e) => e.property === 'lastName')).toBe(true);
    });

    it('rejects non-string lastName', async () => {
      const errors = await validateDto({ ...validPayload, lastName: true });
      const err = errors.find((e) => e.property === 'lastName');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isString');
    });
  });

  describe('role', () => {
    it('accepts a valid role', async () => {
      const errors = await validateDto({
        ...validPayload,
        role: UserRole.CREATOR,
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts omitted role (optional)', async () => {
      const errors = await validateDto(validPayload);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid role value', async () => {
      const errors = await validateDto({
        ...validPayload,
        role: 'SUPERADMIN',
      });
      const err = errors.find((e) => e.property === 'role');
      expect(err).toBeDefined();
      expect(err?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('combined validation', () => {
    it('reports multiple errors simultaneously', async () => {
      const errors = await validateDto({});
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});

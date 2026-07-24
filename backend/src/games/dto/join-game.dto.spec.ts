import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JoinGameDto } from './join-game.dto';

describe('JoinGameDto', () => {
  async function validateDto(plain: object) {
    const dto = plainToInstance(JoinGameDto, plain);
    return validate(dto);
  }

  describe('userId', () => {
    it('accepts a valid UUID', async () => {
      const errors = await validateDto({ userId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(errors).toHaveLength(0);
    });

    it('rejects missing userId', async () => {
      const errors = await validateDto({});

      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find(e => e.property === 'userId');
      expect(userIdError).toBeDefined();
    });

    it('rejects empty string', async () => {
      const errors = await validateDto({ userId: '' });

      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find(e => e.property === 'userId');
      expect(userIdError).toBeDefined();
      expect(userIdError?.constraints).toHaveProperty('isUuid');
    });

    it('rejects non-UUID string', async () => {
      const errors = await validateDto({ userId: 'not-a-uuid' });

      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find(e => e.property === 'userId');
      expect(userIdError).toBeDefined();
      expect(userIdError?.constraints).toHaveProperty('isUuid');
    });

    it('rejects numeric value', async () => {
      const errors = await validateDto({ userId: 12345 });

      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find(e => e.property === 'userId');
      expect(userIdError).toBeDefined();
    });

    it('rejects null value', async () => {
      const errors = await validateDto({ userId: null });

      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find(e => e.property === 'userId');
      expect(userIdError).toBeDefined();
    });

    it('rejects UUID with invalid format', async () => {
      const errors = await validateDto({ userId: '550e8400-e29b-41d4-a716' });

      expect(errors.length).toBeGreaterThan(0);
      const userIdError = errors.find(e => e.property === 'userId');
      expect(userIdError).toBeDefined();
      expect(userIdError?.constraints).toHaveProperty('isUuid');
    });

    it('accepts v4 UUID', async () => {
      const errors = await validateDto({ userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
      expect(errors).toHaveLength(0);
    });
  });
});

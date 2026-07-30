import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;
  const context = {} as ExecutionContext;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleRequest', () => {
    it('returns the user when authentication succeeds', () => {
      const user = { userId: 'user-1' };
      expect(guard.handleRequest(null, user)).toBe(user);
    });

    it('returns undefined instead of throwing when there is no user', () => {
      expect(guard.handleRequest(null, false)).toBeUndefined();
    });

    it('returns undefined instead of throwing when passport reports an error', () => {
      expect(guard.handleRequest(new Error('bad token'), false)).toBeUndefined();
    });
  });

  describe('canActivate', () => {
    it('returns true when passport authentication fails', async () => {
      jest
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockRejectedValue(new Error('no token'));

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('returns true when passport authentication succeeds', async () => {
      jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });
});

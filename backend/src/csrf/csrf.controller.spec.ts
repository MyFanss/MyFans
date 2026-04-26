import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { CsrfController } from './csrf.controller';
import { CSRF_COOKIE } from '../common/middleware/csrf.middleware';

function makeReq(cookies: Record<string, string> = {}): any {
  return { cookies };
}

function makeRes(): { cookie: jest.Mock } {
  return { cookie: jest.fn() };
}

describe('CsrfController', () => {
  let controller: CsrfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CsrfController],
    }).compile();
    controller = module.get(CsrfController);
  });

  it('returns existing token from cookie without setting a new one', () => {
    const existing = crypto.randomBytes(32).toString('hex');
    const req = makeReq({ [CSRF_COOKIE]: existing });
    const res = makeRes();

    const result = controller.getToken(req, res as any);

    expect(result.csrfToken).toBe(existing);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('generates and sets a new cookie when none exists', () => {
    const req = makeReq();
    const res = makeRes();

    const result = controller.getToken(req, res as any);

    expect(typeof result.csrfToken).toBe('string');
    expect(result.csrfToken.length).toBeGreaterThan(0);
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE,
      result.csrfToken,
      expect.objectContaining({ httpOnly: false, sameSite: 'strict' }),
    );
  });
});

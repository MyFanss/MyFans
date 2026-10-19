import { HttpException } from '@nestjs/common';
import { CreatorsController } from './creators.controller';

describe('CreatorsController.getDashboardSummary', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let controller: CreatorsController;

  const buildRequest = (creatorId: string): any => ({
    creator: { id: creatorId },
  });

  beforeEach(() => {
    controller = new CreatorsController();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('throws 403 when the authenticated creator id does not match the route param', () => {
    const request = buildRequest('creator-1');

    expect(() =>
      controller.getDashboardSummary('creator-2', request, undefined),
    ).toThrow(HttpException);

    try {
      controller.getDashboardSummary('creator-2', request, undefined);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
    }
  });

  it("throws the simulated 500 when simulateError is 'true' and NODE_ENV is 'test'", () => {
    process.env.NODE_ENV = 'test';
    const request = buildRequest('creator-1');

    expect(() =>
      controller.getDashboardSummary('creator-1', request, 'true'),
    ).toThrow(HttpException);

    try {
      controller.getDashboardSummary('creator-1', request, 'true');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(500);
    }
  });

  it("does not throw the simulated error when simulateError is 'true' and NODE_ENV is not 'test'", () => {
    process.env.NODE_ENV = 'production';
    const request = buildRequest('creator-1');

    expect(() =>
      controller.getDashboardSummary('creator-1', request, 'true'),
    ).not.toThrow();
  });
});

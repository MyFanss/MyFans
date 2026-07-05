import { ThrottlerGuard } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

import { UsersController } from './users.controller';

const WRITE_HANDLERS = ['create', 'update', 'remove'] as const;
const READ_HANDLERS = ['findAll', 'findOne'] as const;

type UsersControllerHandler = (
  typeof WRITE_HANDLERS | typeof READ_HANDLERS
)[number];

const handlerFor = (handlerName: UsersControllerHandler): unknown =>
  (UsersController.prototype as Record<UsersControllerHandler, unknown>)[
    handlerName
  ];

const apiResponsesFor = (
  handlerName: UsersControllerHandler,
): Record<string, unknown> => {
  const responses = Reflect.getMetadata(
    'swagger/apiResponse',
    handlerFor(handlerName),
  ) as Record<string, unknown> | undefined;

  return responses ?? {};
};

describe('UsersController rate limiting metadata', () => {
  it('applies ThrottlerGuard at the controller level', () => {
    const guards = Reflect.getMetadata('__guards__', UsersController) as
      unknown[] | undefined;

    expect(guards ?? []).toContain(ThrottlerGuard);
  });

  it.each(WRITE_HANDLERS)(
    'limits %s to 5 write requests per minute',
    (handlerName) => {
      const handler = handlerFor(handlerName);

      expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(5);
      expect(Reflect.getMetadata(THROTTLER_TTL + 'default', handler)).toBe(
        60000,
      );
    },
  );

  it.each(READ_HANDLERS)(
    'does not add explicit throttle metadata to read handler %s',
    (handlerName) => {
      const handler = handlerFor(handlerName);

      expect(
        Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(THROTTLER_TTL + 'default', handler),
      ).toBeUndefined();
    },
  );

  it.each(WRITE_HANDLERS)('documents 429 responses for %s', (handlerName) => {
    expect(apiResponsesFor(handlerName)['429']).toMatchObject({
      description: 'Too many requests (5 per minute)',
    });
  });
});

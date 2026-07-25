import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Canonical shape of req.user set by JwtStrategy.validate() */
export interface JwtUserPayload {
  userId: string;
  email: string;
  role?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
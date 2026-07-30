/**
 * @deprecated Not imported by AppModule — this UsersModule/UsersController/
 * UsersService/User entity is dead code, never registered at runtime.
 * The canonical, live Users stack is `src/users` (see `auth-module/auth.module.ts`'s
 * import of `../users/users.module`).
 *
 * This directory is NOT fully dead, though: `user-profile.dto.ts` and
 * `paginated-users-response.dto.ts` (re-exported from `./index.ts`) are
 * still consumed app-wide via `common/dto/index.ts`. Do not delete this
 * directory outright — see backend/docs/AUTH_MODES.md.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // export for AuthModule / other consumers
})
export class UsersModule {}

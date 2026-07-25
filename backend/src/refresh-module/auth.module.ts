/**
 * @deprecated Not imported by AppModule — this JWT+refresh-token auth stack
 * (AuthController/JwtStrategy/RefreshTokenService, and its own `User` entity
 * pulled from `users-module`) is dead code, never registered at runtime.
 * The canonical, live auth stack is `src/auth-module` (see AppModule); the
 * canonical, live `User` entity is `src/users/entities/user.entity.ts`.
 * `refresh-token.entity.ts` in this directory stays referenced (by
 * `users-module/user.entity.ts`'s relation) even though neither of those
 * files is registered with the live TypeORM connection. See
 * backend/docs/AUTH_MODES.md before deleting anything here.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { RefreshToken } from './refresh-token.entity';
import { User } from '../users-module/user.entity';
import { RefreshTokenService } from './refresh-token.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Remove if already registered in AppModule
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_ACCESS_EXPIRES_IN', 900),
        },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken, User]),
  ],
  controllers: [AuthController],
  providers: [RefreshTokenService, JwtStrategy],
  exports: [RefreshTokenService, JwtModule],
})
export class AuthModule { }

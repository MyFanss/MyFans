import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { RefreshTokenService } from './refresh-token.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

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
export class AuthModule {}

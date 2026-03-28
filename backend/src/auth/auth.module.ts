import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WalletAuthService } from './wallet-auth.service';
import { WalletChallenge } from './wallet-challenge.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    ConfigModule,
    EventsModule,
    TypeOrmModule.forFeature([WalletChallenge]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, WalletAuthService],
  exports: [AuthService, WalletAuthService],
})
export class AuthModule {}

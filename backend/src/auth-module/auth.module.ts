import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { WalletLinkingService } from './services/wallet-linking.service';
import { WalletLinkingController } from './controllers/wallet-linking.controller';
import { UserWalletLink } from './entities/user-wallet-link.entity';
import { WalletChallenge } from '../auth/wallet-challenge.entity';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserWalletLink, WalletChallenge]),
    UsersModule,
    EventsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, WalletLinkingService],
  controllers: [AuthController, WalletLinkingController],
  exports: [AuthService, JwtAuthGuard, RolesGuard, WalletLinkingService],
})
export class AuthModule {}

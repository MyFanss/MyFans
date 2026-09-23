import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
    // Challenge issuance is throttled at 5 requests/min per IP and per pubkey.
    // The named 'challenge' throttler is applied on the challenge endpoint via
    // @Throttle({ challenge: { limit: 5, ttl: 60_000 } }) so the rate limit is
    // enforced before signature verification (reduces CPU DoS surface).
    ThrottlerModule.forRoot([
      { name: 'challenge', ttl: 60_000, limit: 5 },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: '24h',
          // Audience/issuer claims bind tokens to this service and prevent
          // cross-service token reuse or role escalation via token tampering.
          issuer: configService.get('JWT_ISSUER') ?? 'stellar-auth',
          audience: configService.get('JWT_AUDIENCE') ?? 'stellar-api',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, WalletLinkingService],
  controllers: [AuthController, WalletLinkingController],
  exports: [AuthService, JwtAuthGuard, RolesGuard, WalletLinkingService],
})
export class AuthModule {}

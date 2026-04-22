import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsModule } from '../events/events.module';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { SubscriptionLifecycleNotifierService } from './subscription-lifecycle-notifier.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    EventsModule,
    ConfigModule,
    TypeOrmModule.forFeature([Notification]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, SubscriptionLifecycleNotifierService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

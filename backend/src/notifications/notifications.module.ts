import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { EventsModule } from '../events/events.module';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SubscriptionLifecycleNotifierService } from './subscription-lifecycle-notifier.service';

@Module({
  imports: [
    EventsModule,
    TypeOrmModule.forFeature([Notification]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret_key',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, SubscriptionLifecycleNotifierService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
